import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageData, mediaType } = await req.json()
    if (!imageData) return NextResponse.json({ error: 'No image data' }, { status: 400 })

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
              text: `Acesta este un buletin/carte de identitate românesc (poate fi rotit, fotografiat din orice unghi, model vechi sau nou).
Extrage EXACT câmpurile vizibile și returnează DOAR un JSON valid, fără text adițional, fără markdown:
{
  "ci_series": "seria CI (2 litere majuscule, ex: AB, CT, IF, RK, KV, TC, MB, KZ)",
  "ci_number": "numărul CI (6 sau 7 cifre - modelul nou are 7 cifre, ex: 1026449)",
  "cnp": "CNP-ul (13 cifre, câmpul CNP/PIN)",
  "birth_date": "data nașterii în format dd.mm.yyyy",
  "last_name": "numele de familie (câmpul Nume/Surname)",
  "first_name": "prenumele complet (câmpul Prenume/Given names)",
  "address": "adresa completă de domiciliu dacă e vizibilă (strada, număr, bloc, apartament)",
  "county": "județul de domiciliu dacă e vizibil (fără cuvântul Județul sau JUD.)",
  "expiry_date": "data expirării în format dd.mm.yyyy dacă e vizibilă",
  "nationality": "cetățenia (ex: ROU)"
}
IMPORTANT:
- Seria și numărul CI sunt în colțul stânga-sus (ex: IF1026449 = serie IF, număr 1026449; RK892004 = serie RK, număr 892004)
- Modelul nou de CI are numărul din 7 cifre (ex: 1026449)
- Modelul vechi are 6 cifre
- Dacă documentul e rotit/întors/fotografiat oblic, citește-l mental corect
- Câmpul Nume/Surname = numele de familie, Prenume/Given names = prenumele
- Păstrează exact diacriticele și cratimele din CI (ex: Răzvan-Andrei, Căpățână, Vasile-Manoilă)
- Dacă un câmp nu e vizibil, returnează string gol ""
- Returnează DOAR JSON-ul, nimic altceva`
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