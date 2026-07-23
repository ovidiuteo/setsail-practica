import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Extrage valori pentru câmpurile unui interes dintr-un email brut.
export async function POST(req: NextRequest) {
  const KEY = process.env.ANTHROPIC_API_KEY
  if (!KEY) return NextResponse.json({ error: 'Lipsește ANTHROPIC_API_KEY (doar pe Vercel).' }, { status: 500 })

  const { text, fields } = await req.json().catch(() => ({}))
  const flds: { key: string; label: string }[] = Array.isArray(fields) ? fields : []
  if (!String(text || '').trim()) return NextResponse.json({ error: 'Email gol.' }, { status: 400 })
  if (!flds.length) return NextResponse.json({ error: 'Niciun câmp de completat.' }, { status: 400 })

  const fieldList = flds.map(f => `- ${f.key} = ${f.label}`).join('\n')

  const system = [
    'Ești un asistent al școlii de navigație SetSail. Primești textul unui email despre un program (curs / practică / expediție) și o listă de câmpuri.',
    'Extrage din email valoarea potrivită pentru fiecare câmp, dacă apare în text.',
    '',
    'CÂMPURI (cheie = etichetă):',
    fieldList,
    '',
    'Reguli:',
    '- Completează DOAR câmpurile pentru care găsești informație clară în email. Nu inventa.',
    '- Valori concise, în română, cu diacritice. Ex. preț „100 euro + TVA / sesiune / zi / persoană"; interval „4–5 august"; ore „marți 16:30–22:30, miercuri 16:00–20:30".',
    '- Dacă un câmp nu are informație în email, omite-l complet din răspuns.',
    'Răspunde DOAR cu JSON valid, fără markdown:',
    '{"values": { "cheie": "valoare", ... }}',
  ].join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: `EMAIL:\n${String(text).slice(0, 12000)}` }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Eroare API Claude' }, { status: 502 })
    const textBlock = (data.content || []).find((c: any) => c?.type === 'text')
    let raw = String(textBlock?.text || '').replace(/```json/gi, '').replace(/```/g, '').trim()
    const a = raw.indexOf('{'); const b = raw.lastIndexOf('}')
    if (a >= 0 && b > a) raw = raw.slice(a, b + 1)
    let parsed: any
    try { parsed = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Răspuns AI neinterpretabil', raw: raw.slice(0, 300) }, { status: 502 }) }
    const values = parsed?.values && typeof parsed.values === 'object' ? parsed.values : {}
    // păstrează doar cheile cerute
    const allowed = new Set(flds.map(f => f.key))
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) if (allowed.has(k) && v != null && String(v).trim()) out[k] = String(v).trim()
    return NextResponse.json({ values: out })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'eroare' }, { status: 500 })
  }
}
