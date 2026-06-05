import { NextRequest, NextResponse } from 'next/server'
import { acteServiceClient, canAccess, isEntity, insertDoc, isLuna, ACTE_BUCKET } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]
const CATEGORII = ['factura', 'chitanta', 'extras', 'contract', 'bon', 'altele']

function extFromName(name: string, type: string): string {
  const dot = name.lastIndexOf('.')
  if (dot > -1 && dot < name.length - 1) return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  return (type.split('/')[1] || 'bin').replace('jpeg', 'jpg')
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })

  const entity = (form.get('entity') as string) || ''
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'Entitate invalidă.' }, { status: 400 })

  const token = (form.get('token') as string) || null
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ ok: false, error: 'Lipsește fișierul.' }, { status: 400 })
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: 'Format acceptat: PDF, imagine, Excel/CSV.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: 'Fișierul depășește 20 MB.' }, { status: 400 })
  }

  let categorie = ((form.get('categorie') as string) || 'altele').toLowerCase()
  if (!CATEGORII.includes(categorie)) categorie = 'altele'
  const nume = ((form.get('nume') as string) || '').slice(0, 200).trim() || null
  const note = ((form.get('note') as string) || '').slice(0, 1000).trim() || null
  const dataDocRaw = ((form.get('data_doc') as string) || '').trim()
  const data_doc = /^\d{4}-\d{2}-\d{2}$/.test(dataDocRaw) ? dataDocRaw : null
  const lunaRaw = ((form.get('luna') as string) || '').toLowerCase().trim()
  const luna = isLuna(lunaRaw) ? lunaRaw : null

  const ext = extFromName(file.name || '', file.type || '')
  const path = `${entity}/${categorie}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const sb = acteServiceClient()
  const { error } = await sb.storage.from(ACTE_BUCKET).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const doc = await insertDoc({
    entity, categorie, nume, data_doc, luna,
    file_path: path,
    file_name: file.name || null,
    file_type: file.type || null,
    file_size: file.size,
    note,
  })
  if (!doc) {
    await sb.storage.from(ACTE_BUCKET).remove([path])
    return NextResponse.json({ ok: false, error: 'Salvare eșuată.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, doc })
}
