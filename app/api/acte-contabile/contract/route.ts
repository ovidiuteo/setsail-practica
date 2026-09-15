import { NextRequest, NextResponse } from 'next/server'
import { acteServiceClient, canAccess, isEntity } from '@/lib/acte-contabile/server'
import {
  buildContractSsyDocx, perioadaImplicita, PLATA_IMPLICITA, EVENIMENT_IMPLICIT,
  type ContractSsyData,
} from '@/lib/acte-contabile/contract-ssy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Contract de prestări servicii SSY pentru facturi emise (încă neîncărcate în sistem).
//   { entity:'ssy', token, action:'extract', file:{base64,mime} | text } -> datele propuse (editabile în pagină)
//   { entity:'ssy', token, action:'generate', data }    -> DOCX
//   { entity:'ssy', token, action:'list' | 'save' (id?, data, factura?, sursa?) | 'delete' (id) } -> contracte salvate

const PROMPT = `Primești o factură românească (document, poză sau text copiat) sau datele unui contract. Extrage datele de mai jos, exact cum apar pe document.

- emisa_de_set_sail_yachting: true dacă FURNIZORUL (emitentul) este SET SAIL YACHTING SRL (CIF 34825339); false dacă Set Sail Yachting e clientul.
- furnizor_nume: numele furnizorului.
- factura_serie, factura_numar, factura_data (YYYY-MM-DD).
- client_*: datele CLIENTULUI (cumpărătorului). client_tip = "pj" pentru firme (SRL, SA, PFA, II, asociații etc.), "pf" pentru persoane fizice.
  client_adresa = adresa completă într-un singur rând (stradă, număr, bloc, sector/localitate, județ). client_cnp doar la persoane fizice; client_cui și client_reg_com doar la firme.
- suma: valoarea TOTALĂ de plată a facturii (număr, punct zecimal). moneda: "RON" sau "EUR".
- descriere_servicii: textul liniilor de pe factură, pe scurt.
- contract_nr / contract_data: dacă factura menționează un contract (ex. „contract SSY631/09.09.2026" -> contract_nr "SSY631", contract_data "2026-09-09").
- eveniment_descriere / eveniment_data_start / eveniment_data_end: doar dacă factura menționează explicit un eveniment, curs sau o perioadă (date YYYY-MM-DD; la o singură zi, start = end).

Pentru orice informație care nu apare pe document folosește "" (sau 0 la sumă). Nu inventa date.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    emisa_de_set_sail_yachting: { type: 'boolean' },
    furnizor_nume: { type: 'string' },
    factura_serie: { type: 'string' },
    factura_numar: { type: 'string' },
    factura_data: { type: 'string' },
    client_tip: { type: 'string', enum: ['pf', 'pj'] },
    client_nume: { type: 'string' },
    client_adresa: { type: 'string' },
    client_cnp: { type: 'string' },
    client_cui: { type: 'string' },
    client_reg_com: { type: 'string' },
    suma: { type: 'number' },
    moneda: { type: 'string', enum: ['RON', 'EUR'] },
    descriere_servicii: { type: 'string' },
    contract_nr: { type: 'string' },
    contract_data: { type: 'string' },
    eveniment_descriere: { type: 'string' },
    eveniment_data_start: { type: 'string' },
    eveniment_data_end: { type: 'string' },
  },
  required: [
    'emisa_de_set_sail_yachting', 'furnizor_nume', 'factura_serie', 'factura_numar', 'factura_data',
    'client_tip', 'client_nume', 'client_adresa', 'client_cnp', 'client_cui', 'client_reg_com',
    'suma', 'moneda', 'descriere_servicii', 'contract_nr', 'contract_data',
    'eveniment_descriere', 'eveniment_data_start', 'eveniment_data_end',
  ],
}

const esteData = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const str = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max)

function curata(x: any): ContractSsyData {
  x = x || {}
  return {
    nr: str(x.nr, 40),
    data: esteData(x.data) ? x.data : '',
    beneficiar_tip: x.beneficiar_tip === 'pj' ? 'pj' : 'pf',
    beneficiar_nume: str(x.beneficiar_nume, 200),
    beneficiar_adresa: str(x.beneficiar_adresa, 400),
    beneficiar_cnp: str(x.beneficiar_cnp, 20),
    beneficiar_cui: str(x.beneficiar_cui, 30),
    beneficiar_reg_com: str(x.beneficiar_reg_com, 40),
    beneficiar_reprezentant: str(x.beneficiar_reprezentant, 120),
    eveniment: str(x.eveniment, 300) || EVENIMENT_IMPLICIT,
    perioada_start: esteData(x.perioada_start) ? x.perioada_start : '',
    perioada_end: esteData(x.perioada_end) ? x.perioada_end : '',
    suma: Math.abs(Number(x.suma) || 0),
    moneda: x.moneda === 'EUR' ? 'EUR' : 'RON',
    plata: str(x.plata, 600) || PLATA_IMPLICITA,
  }
}

// Rândul din DB ↔ datele contractului
function dinRand(r: any) {
  return {
    id: r.id as string, nr: r.nr, data: r.data_contract || '', beneficiar_tip: r.beneficiar_tip,
    beneficiar_nume: r.beneficiar_nume, beneficiar_adresa: r.beneficiar_adresa, beneficiar_cnp: r.beneficiar_cnp,
    beneficiar_cui: r.beneficiar_cui, beneficiar_reg_com: r.beneficiar_reg_com, beneficiar_reprezentant: r.beneficiar_reprezentant,
    eveniment: r.eveniment, perioada_start: r.perioada_start || '', perioada_end: r.perioada_end || '',
    suma: Number(r.suma) || 0, moneda: r.moneda, plata: r.plata,
    factura: r.factura || null, sursa: r.sursa || '', created_at: r.created_at, updated_at: r.updated_at,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, action } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  if (entity !== 'ssy') return NextResponse.json({ ok: false, error: 'Contractele se generează doar pentru Set Sail Yachting.' }, { status: 400 })

  // ── Contracte salvate ──
  if (action === 'list') {
    const { data, error } = await acteServiceClient().from('acte_contabile_contracte').select('*')
      .eq('entity', entity).order('data_contract', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, contracte: (data || []).map(dinRand) })
  }
  if (action === 'save') {
    const d = curata(body.data)
    if (!d.beneficiar_nume) return NextResponse.json({ ok: false, error: 'Lipsește beneficiarul.' }, { status: 400 })
    const rand = {
      entity, nr: d.nr, data_contract: d.data || null, beneficiar_tip: d.beneficiar_tip,
      beneficiar_nume: d.beneficiar_nume, beneficiar_adresa: d.beneficiar_adresa, beneficiar_cnp: d.beneficiar_cnp,
      beneficiar_cui: d.beneficiar_cui, beneficiar_reg_com: d.beneficiar_reg_com, beneficiar_reprezentant: d.beneficiar_reprezentant,
      eveniment: d.eveniment, perioada_start: d.perioada_start || null, perioada_end: d.perioada_end || null,
      suma: d.suma, moneda: d.moneda, plata: d.plata,
      ...(body.factura !== undefined ? { factura: body.factura && typeof body.factura === 'object' ? body.factura : null } : {}),
      ...(body.sursa !== undefined ? { sursa: str(body.sursa, 200) } : {}),
    }
    const sb = acteServiceClient()
    const id = typeof body.id === 'string' && body.id ? body.id : null
    const q = id
      ? sb.from('acte_contabile_contracte').update({ ...rand, updated_at: new Date().toISOString() }).eq('entity', entity).eq('id', id).select('*').maybeSingle()
      : sb.from('acte_contabile_contracte').insert(rand).select('*').maybeSingle()
    const { data, error } = await q
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ ok: false, error: 'Contractul nu a fost găsit.' }, { status: 404 })
    return NextResponse.json({ ok: true, contract: dinRand(data) })
  }
  if (action === 'delete') {
    const { error } = await acteServiceClient().from('acte_contabile_contracte').delete()
      .eq('entity', entity).eq('id', String(body.id || ''))
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Generare DOCX din datele (eventual corectate) din pagină ──
  if (action === 'generate') {
    const data = curata(body.data)
    if (!data.beneficiar_nume) return NextResponse.json({ ok: false, error: 'Lipsește beneficiarul.' }, { status: 400 })
    const buf = await buildContractSsyDocx(data)
    const nume = `Contract ${data.nr || 'SSY'} - ${data.beneficiar_nume}`.replace(/[\\/:*?"<>|]+/g, ' ').trim()
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nume)}.docx`,
      },
    })
  }

  // ── Interpretare factură / text ──
  if (action !== 'extract') return NextResponse.json({ ok: false, error: 'Acțiune necunoscută.' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Citirea automată a facturii nu este configurată (lipsește cheia API).' }, { status: 503 })
  }

  // Sursa: factura încărcată în pagină (base64) sau textul lipit
  const IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const text = str(body.text, 20000)
  const file = body.file && typeof body.file.base64 === 'string' ? body.file as { base64: string; mime: string } : null
  let sursa: any
  if (file) {
    const mime = String(file.mime || '')
    if (mime === 'application/pdf') sursa = { type: 'document', source: { type: 'base64', media_type: mime, data: file.base64 } }
    else if (IMG.includes(mime)) sursa = { type: 'image', source: { type: 'base64', media_type: mime, data: file.base64 } }
    else return NextResponse.json({ ok: false, error: 'Pot citi facturi PDF sau imagini JPG/PNG/WEBP.' }, { status: 400 })
  } else if (text) {
    sursa = { type: 'text', text: 'Textul facturii / datele contractului:\n\n' + text }
  } else {
    return NextResponse.json({ ok: false, error: 'Încarcă factura sau lipește textul ei.' }, { status: 400 })
  }

  let x: any
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 4000,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            sursa,
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      return NextResponse.json({ ok: false, error: 'Eroare la citirea facturii (AI).', detail: t.slice(0, 300) }, { status: 502 })
    }
    const j = await resp.json()
    if (j.stop_reason === 'max_tokens') {
      return NextResponse.json({ ok: false, error: 'Răspunsul AI a fost trunchiat.' }, { status: 502 })
    }
    x = JSON.parse(j.content?.find((c: any) => c.type === 'text')?.text || '{}')
  } catch {
    return NextResponse.json({ ok: false, error: 'Nu am putut interpreta factura.' }, { status: 502 })
  }

  // Datele propuse pentru contract: contractul menționat pe factură, altfel data
  // facturii; perioada din factură, altfel o săptămână după contract → 30 octombrie
  const dataContract = esteData(x.contract_data) ? x.contract_data
    : esteData(x.factura_data) ? x.factura_data
    : new Date().toISOString().slice(0, 10)
  const areEveniment = esteData(x.eveniment_data_start)
  const perioada = areEveniment
    ? { start: x.eveniment_data_start, end: esteData(x.eveniment_data_end) ? x.eveniment_data_end : x.eveniment_data_start }
    : perioadaImplicita(dataContract)

  const propunere: ContractSsyData = {
    nr: str(x.contract_nr, 40),
    data: dataContract,
    beneficiar_tip: x.client_tip === 'pj' ? 'pj' : 'pf',
    beneficiar_nume: str(x.client_nume, 200),
    beneficiar_adresa: str(x.client_adresa, 400),
    beneficiar_cnp: str(x.client_cnp, 20),
    beneficiar_cui: str(x.client_cui, 30),
    beneficiar_reg_com: str(x.client_reg_com, 40),
    beneficiar_reprezentant: '',
    eveniment: str(x.eveniment_descriere, 300) || EVENIMENT_IMPLICIT,
    perioada_start: perioada.start,
    perioada_end: perioada.end,
    suma: Math.abs(Number(x.suma) || 0),
    moneda: x.moneda === 'EUR' ? 'EUR' : 'RON',
    plata: PLATA_IMPLICITA,
  }

  return NextResponse.json({
    ok: true,
    propunere,
    factura: {
      emisa_de_ssy: !!x.emisa_de_set_sail_yachting,
      furnizor: str(x.furnizor_nume, 200),
      serie: str(x.factura_serie, 20), numar: str(x.factura_numar, 30),
      data: esteData(x.factura_data) ? x.factura_data : '',
      descriere: str(x.descriere_servicii, 400),
    },
    perioada_implicita: !areEveniment,
  })
}
