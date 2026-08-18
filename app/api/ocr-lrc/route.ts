import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// OCR pe certificatul de operator radio GMDSS/LRC.
// Scoate numărul, data emiterii și data expirării — exact câmpurile cerute
// de cererea de prelungire („cu nr. ... din data ...") și de verificarea valabilității.
const PROMPT = `Ești un asistent care citește certificate de operator radio maritim (GMDSS / LRC / ROC / GOC),
emise de ANCOM (România) sau de autorități similare.

Extrage EXACT aceste informații, fără să inventezi:
- numarul certificatului (poate apărea ca "Nr.", "No.", "Certificate No.", "Seria/Nr.")
- data emiterii (poate apărea ca "Data eliberării", "Eliberat la", "Date of issue", "Emis la")
- data expirării (poate apărea ca "Valabil până la", "Data expirării", "Valid until", "Date of expiry")

Reguli:
- Datele se întorc STRICT în formatul zz.ll.aaaa (ex. 05.03.2029). Dacă anul e scris cu 2 cifre, completează secolul corect.
- Dacă un câmp nu se vede clar sau lipsește, întoarce string gol "" pentru el. NU ghici.
- Dacă documentul nu pare a fi un certificat de operator radio, întoarce toate câmpurile goale și "is_lrc": false.

Returnează DOAR JSON (fără markdown, fără explicații):
{
  "is_lrc": true sau false,
  "numar": "numărul certificatului sau \\"\\"",
  "emis_la": "zz.ll.aaaa sau \\"\\"",
  "expira_la": "zz.ll.aaaa sau \\"\\""
}`

export async function POST(req: NextRequest) {
  const KEY = process.env.ANTHROPIC_API_KEY
  if (!KEY) return NextResponse.json({ error: 'Lipsește ANTHROPIC_API_KEY (doar pe Vercel).' }, { status: 500 })

  const { imageData, mediaType } = await req.json().catch(() => ({}))
  if (!imageData || typeof imageData !== 'string')
    return NextResponse.json({ error: 'Imagine lipsă' }, { status: 400 })

  const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Eroare API Claude' }, { status: 502 })

    const block = (data.content || []).find((c: any) => c?.type === 'text')
    let raw = String(block?.text || '').replace(/```json|```/g, '').trim()
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}')
    if (a >= 0 && b > a) raw = raw.slice(a, b + 1)
    let parsed: any
    try { parsed = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Răspuns OCR neinterpretabil', raw: raw.slice(0, 300) }, { status: 500 })
    }
    const d = (v: any) => {
      const s = String(v || '').trim()
      return /^\d{2}\.\d{2}\.\d{4}$/.test(s) ? s : ''
    }
    return NextResponse.json({
      success: true,
      data: {
        is_lrc: parsed.is_lrc !== false,
        numar: String(parsed.numar || '').trim(),
        emis_la: d(parsed.emis_la),
        expira_la: d(parsed.expira_la),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'eroare' }, { status: 500 })
  }
}
