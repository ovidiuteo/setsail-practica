import { NextRequest, NextResponse } from 'next/server'
import { acteServiceClient, canAccess, isEntity, ACTE_BUCKET } from '@/lib/acte-contabile/server'
import {
  buildContractSsyDocx, perioadaImplicita, PLATA_IMPLICITA, EVENIMENT_IMPLICIT,
  type ContractSsyData,
} from '@/lib/acte-contabile/contract-ssy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Contract de prestări servicii SSY generat dintr-o factură încărcată.
//   { entity:'ssy', token, action:'extract', doc_id }  -> datele propuse (editabile în pagină)
//   { entity:'ssy', token, action:'generate', data }    -> DOCX

const PROMPT = `Primești o factură românească. Extrage datele de mai jos, exact cum apar pe document.

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, action } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  if (entity !== 'ssy') return NextResponse.json({ ok: false, error: 'Contractele se generează doar pentru Set Sail Yachting.' }, { status: 400 })

  // ── Generare DOCX din datele (eventual corectate) din pagină ──
  if (action === 'generate') {
    const x = body.data || {}
    const data: ContractSsyData = {
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

  // ── Extragere din factura încărcată ──
  if (action !== 'extract') return NextResponse.json({ ok: false, error: 'Acțiune necunoscută.' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Citirea automată a facturii nu este configurată (lipsește cheia API).' }, { status: 503 })
  }

  const sb = acteServiceClient()
  const { data: doc } = await sb.from('acte_contabile_documente')
    .select('id, file_path, file_type, categorie, data_doc')
    .eq('entity', entity).eq('id', String(body.doc_id || '')).maybeSingle()
  if (!doc) return NextResponse.json({ ok: false, error: 'Factura nu a fost găsită.' }, { status: 404 })

  const d = doc as { id: string; file_path: string; file_type: string | null; data_doc: string | null }
  const cale = d.file_path.toLowerCase()
  const mime = d.file_type || ''
  const estePdf = mime === 'application/pdf' || cale.endsWith('.pdf')
  const imgMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime) ? mime
    : cale.endsWith('.png') ? 'image/png' : /\.jpe?g$/.test(cale) ? 'image/jpeg' : cale.endsWith('.webp') ? 'image/webp' : ''
  if (!estePdf && !imgMime) {
    return NextResponse.json({ ok: false, error: 'Pot citi facturi PDF sau imagini JPG/PNG/WEBP.' }, { status: 400 })
  }

  const { data: blob, error: dlErr } = await sb.storage.from(ACTE_BUCKET).download(d.file_path)
  if (dlErr || !blob) return NextResponse.json({ ok: false, error: 'Nu am putut citi fișierul facturii.' }, { status: 500 })
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

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
            estePdf
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
              : { type: 'image', source: { type: 'base64', media_type: imgMime, data: base64 } },
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
    : (esteData(d.data_doc) ? d.data_doc as string : new Date().toISOString().slice(0, 10))
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
