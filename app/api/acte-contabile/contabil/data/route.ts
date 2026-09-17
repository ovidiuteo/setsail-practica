import { NextRequest, NextResponse } from 'next/server'
import { resolveContabilToken, listDocsForMonth, listCheltuieli, ENTITIES } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Pagina contabilului: rezolvă token-ul → entitate + lună + documentele lunii (read-only)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const resolved = await resolveContabilToken(token)
  if (!resolved) return NextResponse.json({ ok: false, error: 'Token invalid sau expirat.' }, { status: 401 })
  const { entity, luna } = resolved
  const [docs, cheltuieli] = await Promise.all([listDocsForMonth(entity, luna), listCheltuieli(entity, luna)])
  // cheltuielile din extras, cu observațiile pentru contabil (fără câmpurile interne)
  const chelt = cheltuieli.map(c => ({
    id: c.id, data: c.data, descriere: c.descriere, suma: c.suma, acoperit: c.acoperit,
    factura_doc_id: c.factura_doc_id, observatii: c.observatii || '',
  }))
  return NextResponse.json({ ok: true, entity, luna, meta: ENTITIES[entity], docs, cheltuieli: chelt })
}
