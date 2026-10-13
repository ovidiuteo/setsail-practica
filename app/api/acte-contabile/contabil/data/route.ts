import { NextRequest, NextResponse } from 'next/server'
import {
  resolveContabilToken, listDocsForMonth, listCheltuieli, listLuniCuDate,
  ENTITIES, isLuna, LUNA_TOATE, LUNI,
} from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Pagina contabilului: rezolvă token-ul → entitate + lună + documentele lunii (read-only).
// Superlink-ul (luna „toate") deschide orice lună a entității: lunile cu date vin în
// `luni`, iar luna cerută prin ?luna= (implicit cea curentă) vine completă.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const resolved = await resolveContabilToken(token)
  if (!resolved) return NextResponse.json({ ok: false, error: 'Token invalid sau expirat.' }, { status: 401 })
  const { entity } = resolved
  const toate = resolved.luna === LUNA_TOATE

  let luni: { luna: string; docs: number; plati: number }[] = []
  let luna = resolved.luna
  if (toate) {
    luni = await listLuniCuDate(entity)
    const ceruta = req.nextUrl.searchParams.get('luna')
    const curenta = LUNI[new Date().getMonth()]
    luna = isLuna(ceruta) ? ceruta : curenta
  }

  const [docs, cheltuieli] = await Promise.all([listDocsForMonth(entity, luna), listCheltuieli(entity, luna)])
  // cheltuielile din extras, cu observațiile pentru contabil (fără câmpurile interne)
  const chelt = cheltuieli.map(c => ({
    id: c.id, data: c.data, descriere: c.descriere, suma: c.suma, acoperit: c.acoperit,
    factura_doc_id: c.factura_doc_id, observatii: c.observatii || '',
  }))
  return NextResponse.json({
    ok: true, entity, luna, toate, luni, luna_curenta: LUNI[new Date().getMonth()],
    meta: ENTITIES[entity], docs, cheltuieli: chelt,
  })
}
