import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { acteServiceClient, canAccess, isEntity, isLuna, ACTE_BUCKET } from '@/lib/acte-contabile/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Etichete dosare în arhivă, per categorie
const CAT_FOLDER: Record<string, string> = {
  extras_cont: 'Extras de cont',
  sumar_facturi: 'Sumar lunar facturi',
  factura: 'Facturi',
  chitanta: 'Chitante',
  extras: 'Extrase bancare',
  contract: 'Contracte',
  bon: 'Bonuri fiscale',
  altele: 'Altele',
}

function safeName(s: string): string {
  return (s || 'document').replace(/[\/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)
}

// GET /api/acte-contabile/zip?entity=ssa&luna=iunie&token=...
export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get('entity')
  const luna = req.nextUrl.searchParams.get('luna')
  const token = req.nextUrl.searchParams.get('token')
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!isLuna(luna)) return NextResponse.json({ ok: false, error: 'invalid luna' }, { status: 400 })
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }

  const sb = acteServiceClient()
  const { data: rows } = await sb.from('acte_contabile_documente')
    .select('categorie, nume, file_path, file_name')
    .eq('entity', entity).eq('luna', luna)
    .order('created_at', { ascending: true })

  const docs = (rows ?? []) as { categorie: string; nume: string | null; file_path: string; file_name: string | null }[]
  if (docs.length === 0) {
    return NextResponse.json({ ok: false, error: 'Nicio înregistrare pentru această lună.' }, { status: 404 })
  }

  const zip = new JSZip()
  const used = new Set<string>()
  let added = 0

  for (const d of docs) {
    const { data: blob, error } = await sb.storage.from(ACTE_BUCKET).download(d.file_path)
    if (error || !blob) continue
    const buf = Buffer.from(await blob.arrayBuffer())

    const folder = CAT_FOLDER[d.categorie] || 'Altele'
    const ext = (d.file_path.split('.').pop() || 'bin').toLowerCase()
    const base = safeName(d.nume || d.file_name || 'document')
    const withExt = /\.[a-z0-9]+$/i.test(base) ? base : `${base}.${ext}`

    let path = `${folder}/${withExt}`
    let i = 2
    while (used.has(path.toLowerCase())) {
      const dot = withExt.lastIndexOf('.')
      const name = dot > 0 ? `${withExt.slice(0, dot)} (${i})${withExt.slice(dot)}` : `${withExt} (${i})`
      path = `${folder}/${name}`
      i++
    }
    used.add(path.toLowerCase())
    zip.file(path, buf)
    added++
  }

  if (added === 0) {
    return NextResponse.json({ ok: false, error: 'Fișierele nu au putut fi descărcate.' }, { status: 500 })
  }

  const content = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
  const fname = `acte-${entity}-${luna}.zip`
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Content-Length': String(content.byteLength),
    },
  })
}
