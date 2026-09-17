import 'server-only'
import { acteServiceClient, ACTE_BUCKET } from '@/lib/acte-contabile/server'

// Citește de pe o factură / bon / chitanță totalul de plată, moneda și emitentul (AI)
// și le salvează pe document (suma_total, moneda, emitent, analizat_la).
// Folosit la încărcare și la potrivirea cu cheltuielile din extras.

export const CATEGORII_CU_SUMA = ['factura', 'bon', 'chitanta']

const PROMPT = `Primești un document contabil românesc (factură, bon fiscal sau chitanță).
Extrage:
- total: suma TOTALĂ de plată (cu TVA), ca număr cu punct zecimal; 0 dacă nu se vede.
- moneda: "RON", "EUR" sau alt cod ISO.
- emitent: numele furnizorului/emitentului.
- data: data documentului (YYYY-MM-DD) sau "".`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    total: { type: 'number' },
    moneda: { type: 'string' },
    emitent: { type: 'string' },
    data: { type: 'string' },
  },
  required: ['total', 'moneda', 'emitent', 'data'],
}

export type DocSuma = {
  id: string; file_path: string; file_type: string | null; file_size?: number | null
  suma_total: number | null; moneda: string | null; emitent: string | null; analizat_la: string | null
}

export type RezultatSuma = { suma_total: number | null; moneda: string | null; emitent: string | null; analizat_la: string }

// Întoarce null dacă citirea n-a reușit (ex. eroare AI) — documentul rămâne neanalizat și se reîncearcă
export async function citesteSumaDocument(doc: DocSuma): Promise<RezultatSuma | null> {
  const sb = acteServiceClient()
  const cale = (doc.file_path || '').toLowerCase()
  const mime = (doc.file_type || '').toLowerCase()
  const estePdf = mime === 'application/pdf' || cale.endsWith('.pdf')
  const img = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime) ? mime
    : /\.jpe?g$/.test(cale) ? 'image/jpeg' : cale.endsWith('.png') ? 'image/png' : cale.endsWith('.webp') ? 'image/webp' : ''

  const salveaza = async (camp: { suma_total: number | null; moneda: string | null; emitent: string | null }) => {
    const r = { ...camp, analizat_la: new Date().toISOString() }
    await sb.from('acte_contabile_documente').update(r).eq('id', doc.id)
    return r
  }
  // formate pe care nu le putem citi (Excel, HEIC…) sau fișiere prea mari: marcate ca analizate, fără sumă
  if ((!estePdf && !img) || (doc.file_size || 0) > 20 * 1024 * 1024) {
    return salveaza({ suma_total: doc.suma_total, moneda: doc.moneda, emitent: doc.emitent })
  }
  if (!process.env.ANTHROPIC_API_KEY) return null

  const { data: blob } = await sb.storage.from(ACTE_BUCKET).download(doc.file_path)
  if (!blob) return null
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            estePdf
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
              : { type: 'image', source: { type: 'base64', media_type: img, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    if (!resp.ok) return null
    const j = await resp.json()
    const x = JSON.parse(j.content?.find((c: any) => c.type === 'text')?.text || '{}')
    const total = Math.abs(Number(x.total) || 0)
    return salveaza({
      suma_total: total > 0 ? Math.round(total * 100) / 100 : null,
      moneda: String(x.moneda || '').trim().toUpperCase().slice(0, 8) || null,
      emitent: String(x.emitent || '').trim().slice(0, 200) || null,
    })
  } catch {
    return null
  }
}
