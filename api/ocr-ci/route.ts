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
        model: 'claude-opus-4-5-20251101',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imgType, data: base64 }
            },
            {
              type: 'text',
              text: `Ești un expert OCR specializat în cărți de identitate românești. Citește TOATE textele vizibile din imagine și extrage datele.

GHID CARTE DE IDENTITATE ROMÂNĂ:
1. COLȚ STÂNGA-SUS: Seria (2 litere) + Numărul (6 sau 7 cifre) lipite, ex: "IF1026449" → serie="IF", număr="1026449"
2. "Nume / Surname" sau "STAMATE": numele de familie
3. "Prenume / Given names" sau "JENICA": prenumele
4. "CNP / PIN" urmat de 13 cifre: codul numeric personal
5. "Data nașterii / Date of birth" sau "21 12 1974": data nașterii  
6. "Data expirării / Date of expiry" sau "28 09 2035": data expirării
7. "Cetățenie / Nationality": ex ROU
8. Pe modelul VECHI (fără chip): adresa de domiciliu

BANDA MRZ (dacă există - șiruri cu < la sfârșit):
- Ex: "STAMATE<<JENICA<<<<<<..." → last_name=STAMATE, first_name=JENICA
- Ex: "174122104447..." primele 13 cifre = CNP
- Dacă CNP-ul nu e vizibil explicit, extrage-l din MRZ

IMPORTANT: 
- Dacă documentul e rotit, citește-l mental în poziția corectă
- Păstrează diacriticele și cratimele EXACT cum apar (Răzvan-Andrei, Căpățână)
- Data expirării este ÎNTOTDEAUNA prezentă pe față — caută-o cu atenție

Returnează DOAR JSON (fără markdown, fără explicații):
{
  "ci_series": "2 litere",
  "ci_number": "6 sau 7 cifre",
  "cnp": "13 cifre",
  "last_name": "numele de familie cu diacritice",
  "first_name": "prenumele cu diacritice și cratime",
  "birth_date": "dd.mm.yyyy",
  "expiry_date": "dd.mm.yyyy",
  "nationality": "ex: ROU",
  "address": "adresa dacă e vizibilă",
  "county": "județul dacă e vizibil"
}`
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
    
    // Log pentru debugging
    console.log('OCR raw response:', text)
    
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      console.log('OCR parsed:', JSON.stringify(parsed))
      return NextResponse.json({ success: true, data: parsed })
    } catch {
      return NextResponse.json({ error: 'Could not parse OCR result', raw: clean }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}