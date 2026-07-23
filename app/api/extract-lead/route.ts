import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Extrage datele unui lead dintr-un email brut (paste din inbox).
export async function POST(req: NextRequest) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'No API key' }, { status: 500 })
  const { text } = await req.json().catch(() => ({}))
  if (!text || typeof text !== 'string' || !text.trim())
    return NextResponse.json({ error: 'Email gol' }, { status: 400 })

  const prompt = [
    'Ești asistentul SetSail (școală de navigație). Extrage datele de contact ale expeditorului/persoanei din emailul brut de mai jos.',
    'Răspunde DOAR cu JSON valid (fără markdown), cu exact aceste chei:',
    '{',
    '  "nume": "numele de familie, MAJUSCULE, sau \\"\\" dacă nu apare",',
    '  "prenume": "prenumele, MAJUSCULE, sau \\"\\"",',
    '  "email": "adresa de email a persoanei (nu a SetSail), sau \\"\\"",',
    '  "telefon": "numărul de telefon (păstrează prefixul), sau \\"\\"",',
    '  "extra": { chei suplimentare utile găsite (ex. localitate, curs_interesat, sesiune, mesaj scurt) — obiect gol {} dacă nimic }',
    '}',
    'Nu inventa date. Dacă un câmp lipsește, pune string gol. Ignoră semnăturile SetSail (office@setsail.ro, 0727..., Corina/Ovidiu/Paula Drugan).',
    '',
    'EMAIL:',
    String(text).slice(0, 12000),
  ].join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim()
    let parsed: any
    try { parsed = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Extragere eșuată', raw }, { status: 502 }) }
    return NextResponse.json({
      nume: (parsed.nume || '').toString().trim(),
      prenume: (parsed.prenume || '').toString().trim(),
      email: (parsed.email || '').toString().trim(),
      telefon: (parsed.telefon || '').toString().trim(),
      extra: parsed.extra && typeof parsed.extra === 'object' ? parsed.extra : {},
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'eroare' }, { status: 500 })
  }
}
