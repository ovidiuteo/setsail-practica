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
              text: `Ești un expert în citirea documentelor de identitate românești. Analizează imaginea și extrage toate datele vizibile.

STRUCTURA CĂRȚII DE IDENTITATE ROMÂNEȘTI:
- Colț stânga-sus: SERIA și NUMĂRUL (ex: "IF1026449" = serie "IF", număr "1026449")
- Câmpul "Nume / Surname": NUMELE DE FAMILIE
- Câmpul "Prenume / Given names": PRENUMELE
- Câmpul "CNP / PIN": cele 13 cifre ale CNP-ului
- Câmpul "Data nașterii / Date of birth": data nașterii
- Câmpul "Data expirării / Date of expiry": data expirării
- Câmpul "Cetățenie / Nationality": ex ROU
- Pe modelul vechi: adresa de domiciliu (pe modelul nou cu chip NU există adresă pe față)

MODELE:
- Model NOU (cu chip auriu pe spate): serie 2 litere + număr 7 cifre, fără adresă pe față
- Model VECHI (fără chip): serie 2 litere + număr 6 cifre, cu adresă pe față

Returnează DOAR acest JSON valid, fără text adițional:
{
  "ci_series": "2 litere majuscule din colțul stânga-sus",
  "ci_number": "6 sau 7 cifre din colțul stânga-sus",
  "cnp": "exact 13 cifre din câmpul CNP/PIN",
  "last_name": "din câmpul Nume/Surname - păstrează diacritice și cratime",
  "first_name": "din câmpul Prenume/Given names - păstrează diacritice și cratime",
  "birth_date": "dd.mm.yyyy din Data nașterii",
  "expiry_date": "dd.mm.yyyy din Data expirării",
  "nationality": "din Cetățenie ex: ROU",
  "address": "adresa dacă e vizibilă, altfel string gol",
  "county": "județul dacă e vizibil, altfel string gol"
}
Dacă documentul e rotit sau fotografiat din unghi, rotește-l mental și citește corect. Dacă un câmp nu e vizibil returnează "".`
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