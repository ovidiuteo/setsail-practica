import { NextRequest, NextResponse } from 'next/server'

const clean = (s: string | null | undefined, max = 150) =>
  (s || '').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export async function POST(req: NextRequest) {
  const { type, emails, prompt: userPrompt } = await req.json()
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  async function callClaude(prompt: string, maxTokens = 1200) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    return text.replace(/```json|```/g, '').trim()
  }

  // ── Tip 1: clasificare pending ────────────────────────────────────────────
  if (type === 'classify') {
    try {
      const emailList = emails.map((e: any, i: number) =>
        `${i + 1}. De la: ${clean(e.from_address, 80)}\n   Subiect: ${clean(e.subject, 80)}\n   Preview: ${clean(e.body_text, 100)}`
      ).join('\n\n')

      const prompt = [
        'Esti asistentul platformei SetSail — o platforma romana de navigatie sportiva.',
        'Clasifica fiecare expeditor ca WHITELIST sau BLACKLIST.',
        'WHITELIST = cursanti, instructori, parteneri, clienti, cereri profesionale.',
        'BLACKLIST = newsletter, promotii, notificari automate, spam, facturi externe.',
        '',
        emailList,
        '',
        `Raspunde DOAR cu JSON array cu exact ${emails.length} obiecte:`,
        '[{"index":0,"proposal":"whitelist","reason":"motiv scurt max 8 cuvinte"}]',
      ].join('\n')

      const text = await callClaude(prompt, 1200)
      const parsed = JSON.parse(text)
      return NextResponse.json({ proposals: parsed })
    } catch (err: any) {
      console.error('classify error:', err?.message)
      return NextResponse.json({ error: 'Claude error', detail: err?.message }, { status: 500 })
    }
  }

  // ── Tip 2: analiză completă email ─────────────────────────────────────────
  if (type === 'analyze') {
    try {
      const email = emails[0]
      const prompt = [
        'Esti asistentul platformei SetSail — o platforma de navigatie sportiva.',
        'Analizeaza emailul si raspunde DOAR cu JSON valid, fara markdown.',
        '',
        `De la: ${clean(email.from_address, 100)}`,
        `Subiect: ${clean(email.subject, 100)}`,
        `Continut: ${clean(email.body_text, 1500)}`,
        '',
        '{"category":"access_request|support|authentication|notification|spam|other","ai_summary":"1-2 propozitii","ai_sentiment":"positive|neutral|negative","ai_priority":"high|medium|low","reply_suggestion_1":"Stil SetSail, profesional","reply_suggestion_2":"Formal, Stimate/Stimata...","reply_suggestion_3":"Friendly, ton cald"}',
      ].join('\n')

      const text = await callClaude(prompt, 1500)
      const parsed = JSON.parse(text)
      return NextResponse.json(parsed)
    } catch (err: any) {
      console.error('analyze error:', err?.message)
      return NextResponse.json({ error: 'Claude error', detail: err?.message }, { status: 500 })
    }
  }

  // ── Tip 3: batch query ────────────────────────────────────────────────────
  if (type === 'batch_query') {
    try {
      const emailList = emails.map((e: any) =>
        `ID:${e.id} | De la: ${clean(e.from_address, 60)} | Subiect: ${clean(e.subject, 80)} | Preview: ${clean(e.body_text, 80)}`
      ).join('\n')

      const prompt = [
        'Esti asistentul platformei SetSail.',
        `Din lista de emailuri, gaseste-le pe cele care corespund cererii: "${clean(userPrompt, 200)}"`,
        '',
        `EMAILURI (${emails.length} total):`,
        emailList,
        '',
        'Raspunde DOAR cu JSON array cu ID-urile emailurilor relevante:',
        '[{"id":"uuid-aici","relevance":"de ce e relevant, max 10 cuvinte"}]',
        'Daca nu exista emailuri relevante, raspunde cu: []',
      ].join('\n')

      const text = await callClaude(prompt, 1000)
      const parsed = JSON.parse(text)
      return NextResponse.json({ results: parsed })
    } catch (err: any) {
      console.error('batch_query error:', err?.message)
      return NextResponse.json({ error: 'Claude error', detail: err?.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
