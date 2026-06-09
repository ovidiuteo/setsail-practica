import 'server-only'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPortalSession } from '@/lib/ssyt/portal-session'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type SsytUploader =
  | { kind: 'portal'; participantId: string; uploadedBy: string }
  | { kind: 'admin'; userId: string; uploadedBy: string }

// Autentifică cererea ca: cursant (cookie portal) SAU admin (Bearer token Supabase Auth).
// NU permite upload public.
export async function authenticateUploader(req: NextRequest): Promise<SsytUploader | null> {
  // 1) Admin via Bearer token
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (token) {
    const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const { data: adminRow } = await supabase
        .from('ssyt_admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (adminRow) return { kind: 'admin', userId: user.id, uploadedBy: user.id }
    }
  }

  // 2) Cursant via cookie sesiune portal
  const session = await getPortalSession()
  if (session) {
    return { kind: 'portal', participantId: session.participantId, uploadedBy: session.participantId }
  }

  return null
}
