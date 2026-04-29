import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageData, mediaType } = await req.json()

    if (!imageData) {
      return NextResponse.json({ error: 'No image data' }, { status: 400 })
    }

    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
    const imgType = mediaType || 'image/jpeg'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imgType, data: base64 }
            },
            {
              type: 'text',
              text: `Acesta este un buletin/carte de identitate românesc. Extrage EXACT câmpurile vizibile și returnează DOAR un JSON valid, fără text adițional, fără markdown:
{
  "ci_series": "seria CI (2 litere majuscule, ex: AB, CT, IF)",
  "ci_number": "numărul CI (6 cifre, ex: 123456)",
  "birth_date": "data nașterii în format dd.mm.yyyy",
  "address": "adresa completă de domiciliu (strada, număr, bloc, apartament - fără județ)",
  "county": "județul de domiciliu (fără cuvântul Județul sau JUD.)",
  "last_name": "numele de familie",
  "first_name": "prenumele complet"
}
Dacă un câmp nu este vizibil sau lizibil, folosește string gol "". Returnează DOAR JSON-ul, nimic altceva.`
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: 'Claude API error: ' + err }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      return NextResponse.json({ success: true, data: parsed })
    } catch {
      return NextResponse.json({ error: 'Could not parse OCR result', raw: clean }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
