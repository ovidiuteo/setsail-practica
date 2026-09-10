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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    return text.replace(/```json|```/g, '').trim()
  }

  // ── Tip 1: clasificare pending ─────────────────────────────────────────────
  // Clasificam EXPEDITORI unici, iar raspunsul e legat de adresa de email, nu de
  // un index: modelul se incurca la numerotare (batch-ul al doilea intorcea
  // 21,22,23… in loc de 20,21,22…), iar propunerile ajungeau pe alt expeditor.
  if (type === 'classify') {
    try {
      // un singur rand per adresa — pagina oricum tine propunerile pe adresa
      const perAdresa = new Map<string, any>()
      for (const e of emails || []) {
        const adr = String(e?.from_address || '').trim()
        if (adr && !perAdresa.has(adr.toLowerCase())) perAdresa.set(adr.toLowerCase(), e)
      }
      const unice: any[] = []
      perAdresa.forEach(v => unice.push(v))

      const proposals: any[] = []
      const fara: string[] = []          // expeditori la care modelul n-a raspuns
      const batchSize = 15

      for (let start = 0; start < unice.length; start += batchSize) {
        const batch = unice.slice(start, start + batchSize)

        const emailList = batch.map((e: any) =>
          `- from: ${clean(e.from_address, 80)}\n  subiect: ${clean(e.subject, 80)}\n  preview: ${clean(e.body_text, 80)}`
        ).join('\n\n')

        const prompt = [
          'Esti asistentul platformei SetSail — o platforma romana de navigatie sportiva.',
          'Clasifica fiecare expeditor ca whitelist sau blacklist.',
          'whitelist = cursanti (actuali, fosti sau care vor sa se inscrie), instructori, parteneri, clienti, cereri profesionale, interes pentru cursuri sau expeditii.',
          'blacklist = newsletter, promotii, notificari automate, spam, facturi externe.',
          '',
          emailList,
          '',
          `Raspunde DOAR cu un JSON array cu exact ${batch.length} obiecte, cate unul pentru fiecare expeditor de mai sus.`,
          'Campul "from" trebuie copiat EXACT ca in lista. "proposal" e scris cu litere mici: whitelist sau blacklist.',
          '[{"from":"adresa@exemplu.ro","proposal":"whitelist","reason":"motiv scurt max 8 cuvinte"}]',
        ].join('\n')

        let parsed: any[] = []
        try {
          parsed = JSON.parse(await callClaude(prompt, 4000))
          if (!Array.isArray(parsed)) parsed = []
        } catch (e: any) {
          // un lot picat nu mai arunca tot rezultatul la gunoi
          console.error('classify batch error:', e?.message)
          parsed = []
        }

        // potrivire pe adresa; indexul ramane doar ca rezerva
        const ramase = new Map(batch.map((e: any, i: number) => [String(e.from_address).toLowerCase(), i]))
        for (const p of parsed) {
          const prop = String(p?.proposal || '').trim().toLowerCase()
          if (prop !== 'whitelist' && prop !== 'blacklist') continue

          const dupaAdresa = String(p?.from || '').trim().toLowerCase()
          let i = ramase.get(dupaAdresa)
          if (i === undefined && typeof p?.index === 'number') {
            const rel = p.index >= start ? p.index - start : p.index    // 0- sau 1-based, absolut sau local
            if (rel >= 0 && rel < batch.length) i = rel
          }
          if (i === undefined) continue

          const e = batch[i]
          ramase.delete(String(e.from_address).toLowerCase())
          proposals.push({
            from_address: e.from_address,
            proposal: prop,
            reason: clean(p?.reason, 60),
          })
        }
        ramase.forEach(i => fara.push(batch[i].from_address))
      }

      return NextResponse.json({ proposals, unclassified: fara })
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
