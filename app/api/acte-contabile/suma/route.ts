import { NextRequest, NextResponse } from 'next/server'
import { acteServiceClient, canAccess, isEntity } from '@/lib/acte-contabile/server'
import { citesteSumaDocument, type DocSuma } from '@/lib/acte-contabile/suma-document'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Suma unui document (factură / bon / chitanță).
//   POST { entity, token, id, action:'citeste' }                 -> citește totalul de pe document (AI)
//   POST { entity, token, id, action:'seteaza', suma, moneda? }  -> corectare manuală (suma goală = șterge)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, id, action } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })

  const sb = acteServiceClient()
  const { data: doc } = await sb.from('acte_contabile_documente')
    .select('id, file_path, file_type, file_size, suma_total, moneda, emitent, analizat_la')
    .eq('entity', entity).eq('id', String(id)).maybeSingle()
  if (!doc) return NextResponse.json({ ok: false, error: 'Documentul nu a fost găsit.' }, { status: 404 })

  if (action === 'seteaza') {
    const txt = String(body.suma ?? '').trim().replace(/\s/g, '')
    // acceptă 1.234,56 / 1234,56 / 1234.56
    const norm = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt
    const suma = txt === '' ? null : Number(norm)
    if (suma !== null && (!isFinite(suma) || suma < 0)) return NextResponse.json({ ok: false, error: 'Sumă invalidă.' }, { status: 400 })
    const camp = {
      suma_total: suma === null ? null : Math.round(suma * 100) / 100,
      moneda: String(body.moneda || (doc as any).moneda || 'RON').toUpperCase().slice(0, 8),
      analizat_la: new Date().toISOString(),
    }
    const { error } = await sb.from('acte_contabile_documente').update(camp).eq('id', (doc as any).id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, ...camp, emitent: (doc as any).emitent })
  }

  const r = await citesteSumaDocument(doc as DocSuma)
  if (!r) return NextResponse.json({ ok: false, error: 'Nu am putut citi suma de pe document.' }, { status: 502 })
  return NextResponse.json({ ok: true, ...r })
}
