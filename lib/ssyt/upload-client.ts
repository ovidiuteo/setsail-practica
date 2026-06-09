'use client'
import { createSupabaseBrowserClient } from './supabase-browser'

export type UploadContext = 'regatta_document' | 'boat_file' | 'team_photo' | 'boat_resource' | 'team_resource'

export type UploadOpts = {
  context: UploadContext
  admin?: boolean // adaugă Bearer token (rute apelate din admin)
  optimize?: boolean // optimizează imaginile (webp) — folosit la poze
  regattaId?: string
  teamId?: string
  boatId?: string
  participantId?: string
}

export type UploadedFile = {
  id: string
  url: string
  r2_key: string
  content_type: string
  size_bytes: number
  filename: string
}

async function adminAuthHeader(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Nu ești logat ca admin.')
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function uploadSsytFile(file: File, opts: UploadOpts): Promise<UploadedFile> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('context', opts.context)
  if (opts.optimize) fd.append('optimize', 'true')
  if (opts.regattaId) fd.append('regatta_id', opts.regattaId)
  if (opts.teamId) fd.append('team_id', opts.teamId)
  if (opts.boatId) fd.append('boat_id', opts.boatId)
  if (opts.participantId) fd.append('participant_id', opts.participantId)

  const headers = opts.admin ? await adminAuthHeader() : {}
  const res = await fetch('/api/ssyt/files/upload', { method: 'POST', body: fd, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload eșuat.')
  return data as UploadedFile
}

export async function deleteSsytFile(arg: { id?: string; url?: string; admin?: boolean }): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (arg.admin) {
    try { Object.assign(headers, await adminAuthHeader()) } catch { /* best-effort */ }
  }
  await fetch('/api/ssyt/files', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ id: arg.id, url: arg.url }),
  }).catch(() => {})
}
