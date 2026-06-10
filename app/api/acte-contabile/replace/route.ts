import { NextRequest, NextResponse } from 'next/server'
import { acteServiceClient, canAccess, isEntity, ACTE_BUCKET, SIGNED_URL_TTL } from '@/lib/acte-contabile/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]

function extFromName(name: string, type: string): string {
  const dot = name.lastIndexOf('.')
  if (dot > -1 && dot < name.length - 1) return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  return (type.split('/')[1] || 'bin').replace('jpeg', 'jpg')
}

// Înlocuiește fișierul unui document existent, păstrând rândul (denumire, categorie, lună, notă)
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })

  const entity = (form.get('entity') as string) || ''
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'Entitate invalidă.' }, { status: 400 })

  const token = (form.get('token') as string) || null
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }

  const id = (form.get('id') as string) || ''
  if (!id) return NextResponse.json({ ok: false, error: 'Lipsește id-ul.' }, { status: 400 })

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ ok: false, error: 'Lipsește fișierul.' }, { status: 400 })
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: 'Format acceptat: PDF, imagine, Excel/CSV.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: 'Fișierul depășește 20 MB.' }, { status: 400 })
  }

  const sb = acteServiceClient()
  const { data: row } = await sb.from('acte_contabile_documente')
    .select('id, categorie, file_path').eq('id', id).eq('entity', entity).maybeSingle()
  if (!row) return NextResponse.json({ ok: false, error: 'Document inexistent.' }, { status: 404 })

  const oldPath = (row as { file_path: string }).file_path
  const categorie = (row as { categorie: string }).categorie
  const ext = extFromName(file.name || '', file.type || '')
  const newPath = `${entity}/${categorie}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await sb.storage.from(ACTE_BUCKET).upload(newPath, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

  const { data: updated, error: updErr } = await sb.from('acte_contabile_documente')
    .update({
      file_path: newPath,
      file_name: file.name || null,
      file_type: file.type || null,
      file_size: file.size,
    })
    .eq('id', id).eq('entity', entity)
    .select().single()
  if (updErr) {
    await sb.storage.from(ACTE_BUCKET).remove([newPath])
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
  }

  // șterge fișierul vechi din storage
  if (oldPath && oldPath !== newPath) {
    await sb.storage.from(ACTE_BUCKET).remove([oldPath]).catch(() => {})
  }

  // URL semnat proaspăt pentru noul fișier
  const { data: signed } = await sb.storage.from(ACTE_BUCKET).createSignedUrl(newPath, SIGNED_URL_TTL)
  const doc = { ...(updated as any), url: signed?.signedUrl ?? null }

  return NextResponse.json({ ok: true, doc })
}
