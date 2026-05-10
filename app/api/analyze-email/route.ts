import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { type, emails, prompt: userPrompt } = await req.json()
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  // ── Tip 1: clasificare pending ────────────────────────────────────────────
  if (type === 'classify') {
    const list = emails.map((e: any, i: number) =>
      `${i + 1}. De la: ${e.from_address}\n   Subiect: ${e.subject}\n   Preview: ${e.body_text?.slice(0, 150) || '(fără conținut)'}`
    ).join('\n\n')

    const prompt = `Ești asistentul platformei SetSail — o platformă română de navigație sportivă.
Clasifică fiecare expeditor ca WHITELIST sau BLACKLIST.
WHITELIST = cursanți, instructori, parteneri, clienți, cereri profesionale.
BLACKLIST = newsletter, promoții, notificări automate, spam, facturi externe.

${list}

Răspunde DOAR cu JSON array cu exact ${emails.length} obiecte:
[{"index":0,"proposal":"whitelist","reason":"motiv scurt max 8 cuvinte"}]`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.content?.[0]?.text?.replace(/```json|```/g, '').trim() || '[]')
      return NextResponse.json({ proposals: parsed })
    } catch (err: any) { console.error('Claude error:', err?.message, err); return NextResponse.json({ error: 'Claude error', detail: err?.message }, { status: 500 }) }
  }

  // ── Tip 2: analiză completă email ─────────────────────────────────────────
  if (type === 'analyze') {
    const email = emails[0]
    const prompt = `Ești asistentul platformei SetSail — o platformă de navigație sportivă.
Analizează emailul și răspunde DOAR cu JSON valid, fără markdown.

De la: ${email.from_address}
Subiect: ${email.subject}
Conținut: ${email.body_text?.slice(0, 2000) || '(fără conținut)'}

{"category":"access_request|support|authentication|notification|spam|other","ai_summary":"1-2 propoziții","ai_sentiment":"positive|neutral|negative","ai_priority":"high|medium|low","reply_suggestion_1":"Stil SetSail, profesional","reply_suggestion_2":"Formal, Stimate/Stimată...","reply_suggestion_3":"Friendly, ton cald"}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.content?.[0]?.text?.replace(/```json|```/g, '').trim() || '{}')
      return NextResponse.json(parsed)
    } catch (err: any) { console.error('Claude error:', err?.message, err); return NextResponse.json({ error: 'Claude error', detail: err?.message }, { status: 500 }) }
  }

  // ── Tip 3: batch query ────────────────────────────────────────────────────
  if (type === 'batch_query') {
    const list = emails.map((e: any, i: number) =>
      `ID:${e.id} | De la: ${e.from_address} | Subiect: ${e.subject} | Preview: ${e.body_text?.slice(0, 100) || ''}`
    ).join('\n')

    const prompt = `Ești asistentul platformei SetSail — o platformă română de navigație sportivă.

Din lista de emailuri de mai jos, găsește-le pe cele care corespund cererii utilizatorului.

CERERE: "${userPrompt}"

EMAILURI (${emails.length} total):
${list}

Răspunde DOAR cu JSON array cu ID-urile emailurilor relevante și un scurt motiv:
[{"id":"uuid-aici","relevance":"de ce e relevant, max 10 cuvinte"}]

Dacă nu există emailuri relevante, răspunde cu array gol: []`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.content?.[0]?.text?.replace(/```json|```/g, '').trim() || '[]')
      return NextResponse.json({ results: parsed })
    } catch (err: any) { console.error('Claude error:', err?.message, err); return NextResponse.json({ error: 'Claude error', detail: err?.message }, { status: 500 }) }
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
