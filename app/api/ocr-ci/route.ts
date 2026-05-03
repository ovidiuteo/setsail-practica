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
              text: `Ești un expert OCR pentru documente de identitate românești. Determină tipul documentului și extrage datele.

TIPURI DE DOCUMENTE:

1. CARTE DE IDENTITATE (CI) — card plastic, "ROMÂNIA - CARTE DE IDENTITATE"
   - Colț stânga-sus: Seria (2 litere) + Numărul lipit → ex: "IF1026449" = serie "IF", număr "1026449"
   - Model NOU (cu chip auriu pe spate): 7 cifre, fără adresă pe față
   - Model VECHI: 6 cifre, cu adresă pe față
   - ci_series = cele 2 litere, ci_number = cifrele

2. PAȘAPORT ROMÂNESC — "PAȘAPORT / PASSPORT", "ROMÂNIA / ROMANIA / ROUMANIE"
   - Numărul pașaportului (ex: 058339673) → ci_number = numărul pașaportului, ci_series = "PP"
   - Câmpuri: 1.Nume, 2.Prenume, 3.Cetățenie, 4.Data nașterii, Cod Numeric Personal
   - Banda MRZ (rânduri cu <<): ex "058339673ROU9211294..." → CNP = 1921129420025 (13 cifre)
   - Locul nașterii (ex: BUCUREȘTI) → câmpul "city"
   - Pașaportul NU are adresă → address = ""

REGULI COMUNE:
- Păstrează diacriticele și cratimele EXACT (Răzvan-Andrei, Căpățână, Vasile-Manoilă)
- address = DOAR strada+nr+bloc+ap (fără localitate și județ)
- city = localitatea de domiciliu
- county = dacă city=București → "Sector X"; altfel județul fără prefix
- Dacă documentul e rotit, citește-l mental corect
- Data expirării: ÎNTOTDEAUNA prezentă — caută cu atenție

Returnează DOAR JSON (fără markdown):
{
  "doc_type": "CI" sau "PASAPORT",
  "ci_series": "2 litere pentru CI, sau PP pentru pașaport",
  "ci_number": "6-7 cifre pentru CI, sau numărul pașaportului",
  "cnp": "exact 13 cifre",
  "last_name": "numele de familie cu diacritice",
  "first_name": "prenumele cu diacritice și cratime",
  "birth_date": "dd.mm.yyyy",
  "expiry_date": "dd.mm.yyyy",
  "nationality": "ROU sau altele",
  "address": "strada+nr+bloc+ap sau gol pentru pașaport",
  "city": "localitatea de domiciliu sau naștere",
  "county": "județul/sectorul dacă e vizibil",
  "country": "Romania"
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