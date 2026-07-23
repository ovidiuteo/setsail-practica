import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Decodează quoted-printable (=3D, =C3=AE...) respectând UTF-8 multi-byte.
function decodeQuotedPrintable(s: string): string {
  const noSoft = s.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let i = 0; i < noSoft.length; i++) {
    const c = noSoft[i]
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(noSoft.substr(i + 1, 2))) {
      bytes.push(parseInt(noSoft.substr(i + 1, 2), 16)); i += 2
    } else {
      bytes.push(noSoft.charCodeAt(i) & 0xff)
    }
  }
  try { return Buffer.from(bytes).toString('utf8') } catch { return noSoft }
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
}

// Curăță un email brut (headere + MIME) → antet From + corp text lizibil.
function cleanEmail(raw: string): { from: string; body: string } {
  const isQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(raw)
  const fromMatch = raw.match(/^From:\s*(.+)$/im)
  const from = fromMatch ? fromMatch[1].trim() : ''

  // corpul: după prima linie goală (sfârșitul headerelor)
  let body = raw
  const sep = raw.search(/\r?\n\r?\n/)
  if (sep >= 0) body = raw.slice(sep + 1)
  if (isQP) body = decodeQuotedPrintable(body)
  if (/<[a-z!/]/i.test(body)) body = stripHtml(body)
  // curăță boundary-uri MIME, whitespace excesiv
  body = body.replace(/--[A-Za-z0-9-]{10,}--?/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return { from, body }
}

export async function POST(req: NextRequest) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'No API key' }, { status: 500 })
  const { text } = await req.json().catch(() => ({}))
  if (!text || typeof text !== 'string' || !text.trim())
    return NextResponse.json({ error: 'Email gol' }, { status: 400 })

  const { from, body } = cleanEmail(String(text))

  const prompt = [
    'Ești asistentul SetSail (școală de navigație). Extrage datele de contact ale PERSOANEI care scrie (expeditorul, nu SetSail).',
    'Emailul poate conține și mesaje citate/forward mai vechi — folosește-le doar dacă lipsesc date, dar prioritizează expeditorul curent.',
    'Răspunde DOAR cu JSON valid (fără markdown, fără explicații), cu exact aceste chei:',
    '{"nume":"nume de familie MAJUSCULE sau \\"\\"","prenume":"prenume MAJUSCULE sau \\"\\"","email":"emailul persoanei (nu office@setsail.ro) sau \\"\\"","telefon":"telefon cu prefix sau \\"\\"","extra":{ chei utile ex. curs_interesat, sesiune, mesaj scurt; {} dacă nimic }}',
    'Nu inventa. Ignoră semnăturile SetSail (office@setsail.ro, 0727387245, Corina/Ovidiu/Paula Drugan, Ruxandra Taloș).',
    '',
    from ? `ANTET From: ${from}` : '',
    '',
    'CONȚINUT EMAIL:',
    body.slice(0, 8000),
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Eroare API Claude' }, { status: 502 })
    let raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim()
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) raw = m[0]
    let parsed: any
    try { parsed = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Răspuns AI neinterpretabil', raw: raw.slice(0, 300) }, { status: 502 }) }
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
