import { NextRequest, NextResponse } from 'next/server'
import { acteServiceClient, canAccess, isEntity, isLuna, LUNI } from '@/lib/acte-contabile/server'
import { citesteSumaDocument, CATEGORII_CU_SUMA, type DocSuma } from '@/lib/acte-contabile/suma-document'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Potrivește cheltuielile neacoperite dintr-o lună cu facturile/bonurile/chitanțele încărcate.
//   POST { entity, token, luna } -> { ok, potrivite:[{ cheltuiala_id, doc_id }], citite }
// Documentelor fără sumă li se citește totalul (o singură dată). Potrivirea = aceeași sumă
// în lei, la ban. Căutăm în luna cheltuielii și în lunile vecine (facturile vin des decalat).

type Doc = DocSuma & { luna: string | null; nume: string | null; file_name: string | null; data_doc: string | null }

// cuvinte comune între descrierea cheltuielii și emitent/nume/fișier — departajează la sume egale
function asemanare(a: string, b: string) {
  const cuv = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3))
  const A = cuv(a), B = cuv(b)
  let n = 0
  A.forEach(w => { if (B.has(w)) n++ })
  return n
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, luna } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!isLuna(luna)) return NextResponse.json({ ok: false, error: 'invalid luna' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })

  const sb = acteServiceClient()
  const { data: chelt } = await sb.from('acte_contabile_cheltuieli')
    .select('id, data, descriere, suma, acoperit, factura_doc_id').eq('entity', entity).eq('luna', luna)
  const neacoperite = (chelt || []).filter((c: any) => !c.acoperit && !c.factura_doc_id)
  if (!neacoperite.length) return NextResponse.json({ ok: true, potrivite: [], citite: 0 })

  const i = LUNI.indexOf(luna)
  const luni = [LUNI[(i + 11) % 12], luna, LUNI[(i + 1) % 12]]
  const [{ data: docsRaw }, { data: legate }] = await Promise.all([
    sb.from('acte_contabile_documente')
      .select('id, luna, nume, file_path, file_type, file_name, file_size, data_doc, suma_total, moneda, emitent, analizat_la')
      .eq('entity', entity).in('luna', luni).in('categorie', CATEGORII_CU_SUMA),
    sb.from('acte_contabile_cheltuieli').select('factura_doc_id').eq('entity', entity).not('factura_doc_id', 'is', null),
  ])
  const folosite = new Set((legate || []).map((r: any) => r.factura_doc_id))
  const docs = ((docsRaw || []) as Doc[]).filter(d => !folosite.has(d.id))

  // documentele neanalizate: citim totalul (câte 4 în paralel)
  let citite = 0
  const deCitit = docs.filter(d => !d.analizat_la)
  for (let k = 0; k < deCitit.length; k += 4) {
    await Promise.all(deCitit.slice(k, k + 4).map(async d => {
      const r = await citesteSumaDocument(d)
      if (r) { Object.assign(d, r); citite++ }
    }))
  }

  const potrivite: { cheltuiala_id: string; doc_id: string }[] = []
  const luat = new Set<string>()
  const zi = (s: string | null) => (s ? new Date(s).getTime() : NaN)
  const text = (d: Doc) => `${d.emitent || ''} ${d.nume || ''} ${d.file_name || ''}`
  for (const c of neacoperite as any[]) {
    const suma = Number(c.suma)
    const candidati = docs.filter(d => !luat.has(d.id) && d.suma_total != null
      && (!d.moneda || d.moneda === 'RON' || d.moneda === 'LEI')
      && Math.abs(Number(d.suma_total) - suma) < 0.005)
    if (!candidati.length) continue
    // la mai mulți candidați: cel mai asemănător ca nume, apoi aceeași lună, apoi data cea mai apropiată
    candidati.sort((a, b) => {
      const s = asemanare(c.descriere, text(b)) - asemanare(c.descriere, text(a))
      if (s) return s
      const l = Number(b.luna === luna) - Number(a.luna === luna)
      if (l) return l
      const da = Math.abs(zi(a.data_doc) - zi(c.data)), db = Math.abs(zi(b.data_doc) - zi(c.data))
      return (isNaN(da) ? Infinity : da) - (isNaN(db) ? Infinity : db)
    })
    const d = candidati[0]
    luat.add(d.id)
    const { error } = await sb.from('acte_contabile_cheltuieli')
      .update({ acoperit: true, factura_doc_id: d.id }).eq('id', c.id).eq('entity', entity)
    if (!error) potrivite.push({ cheltuiala_id: c.id, doc_id: d.id })
  }

  return NextResponse.json({ ok: true, potrivite, citite })
}
