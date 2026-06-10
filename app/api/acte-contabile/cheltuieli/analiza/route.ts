import { NextRequest, NextResponse } from 'next/server'
import {
  acteServiceClient, canAccess, isEntity, isLuna, replaceCheltuieliExtras, ACTE_BUCKET,
} from '@/lib/acte-contabile/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROMPT = `Ești expert în extrase de cont bancare românești. Primești un extras de cont (PDF).
Extrage DOAR tranzacțiile de tip DEBIT (bani IEȘIȚI din cont = cheltuieli/plăți).

REGULI:
- Include: plăți către furnizori, comisioane bancare, plăți la bugetul de stat/taxe, retrageri, plăți card.
- EXCLUDE: încasările (credit / bani intrați), "Soldul zilei", "Sold inițial", "Sold final", rulajele, anteturile, textul de subsol.
- Pentru fiecare cheltuială: data operațiunii, o descriere scurtă și clară (numele beneficiarului sau natura operațiunii, ex: "WIZZ AIR", "Comision OPIB interbancar", "Buget de stat - contributii", "Alfa Cont SRL") și suma în RON.
- Dacă o plată e în valută, folosește suma în RON debitată din cont.
- suma = număr pozitiv (RON), cu punct zecimal. Fără separatori de mii.

Returnează DOAR JSON (fără markdown, fără explicații), un array:
[
  { "data": "YYYY-MM-DD", "descriere": "text scurt", "suma": 1336.00 },
  ...
]
Dacă nu găsești nicio cheltuială, returnează [].`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, luna } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!isLuna(luna)) return NextResponse.json({ ok: false, error: 'invalid luna' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Extragerea automată nu este configurată (lipsește cheia API).' }, { status: 503 })
  }

  const sb = acteServiceClient()
  const { data: doc } = await sb.from('acte_contabile_documente')
    .select('id, file_path, file_type')
    .eq('entity', entity).eq('luna', luna).eq('categorie', 'extras_cont')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!doc) return NextResponse.json({ ok: false, error: 'Niciun extras de cont încărcat pentru această lună.' }, { status: 404 })

  const d = doc as { id: string; file_path: string; file_type: string | null }
  if (d.file_type !== 'application/pdf' && !d.file_path.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ ok: false, error: 'Extragerea funcționează doar pentru extrase PDF.' }, { status: 400 })
  }

  const { data: blob, error: dlErr } = await sb.storage.from(ACTE_BUCKET).download(d.file_path)
  if (dlErr || !blob) return NextResponse.json({ ok: false, error: 'Nu am putut citi extrasul.' }, { status: 500 })
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

  let aiText = ''
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    if (!resp.ok) {
      const errTxt = await resp.text()
      return NextResponse.json({ ok: false, error: 'Eroare la analiză (AI).', detail: errTxt.slice(0, 300) }, { status: 502 })
    }
    const data = await resp.json()
    aiText = data.content?.find((c: any) => c.type === 'text')?.text || '[]'
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Conexiune eșuată la serviciul de analiză.' }, { status: 502 })
  }

  // parse JSON (curăță eventuale fences)
  const clean = aiText.replace(/```json|```/g, '').trim()
  let parsed: any
  try { parsed = JSON.parse(clean) } catch {
    return NextResponse.json({ ok: false, error: 'Răspunsul analizei nu a putut fi interpretat.' }, { status: 502 })
  }
  if (!Array.isArray(parsed)) parsed = []

  const rows = parsed
    .map((r: any) => ({
      data: typeof r?.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.data) ? r.data : null,
      descriere: String(r?.descriere || '').slice(0, 300).trim(),
      suma: Math.abs(Number(r?.suma) || 0),
    }))
    .filter((r: { descriere: string; suma: number }) => r.descriere && r.suma > 0)

  const items = await replaceCheltuieliExtras(entity, luna, d.id, rows)
  return NextResponse.json({ ok: true, items, count: items.length })
}
