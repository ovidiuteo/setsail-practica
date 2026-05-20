import { NextRequest } from 'next/server'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'
import { buildPrintHtml, buildSignedUrls, renderTemplate } from '@/lib/ssyt/template-render'

export const dynamic = 'force-dynamic'

function plainResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; templateId: string } }
) {
  const session = await getPortalSession()
  if (!session) return plainResponse('Neautentificat.', 401)

  const supabase = getPortalSupabase()

  const { data: app } = await supabase
    .from('ssyt_club_applications')
    .select('id, participant_id, club_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!app) return plainResponse('Aplicație inexistentă.', 404)
  if (app.participant_id !== session.participantId) {
    return plainResponse('Aplicația nu îți aparține.', 403)
  }

  const { data: template } = await supabase
    .from('ssyt_club_document_templates')
    .select('id, title, html_content, club_id')
    .eq('id', params.templateId)
    .maybeSingle()

  if (!template || template.club_id !== app.club_id) {
    return plainResponse('Template inexistent sau incompatibil cu acest club.', 404)
  }

  const { data: club } = await supabase
    .from('ssyt_sport_clubs')
    .select('id, name, address, phone, website')
    .eq('id', app.club_id)
    .maybeSingle()

  if (!club) return plainResponse('Club inexistent.', 404)

  const signedUrls = await buildSignedUrls(session.participant)

  const body = renderTemplate(template.html_content || '', {
    participant: session.participant,
    club,
    signedUrls,
  })

  const fullHtml = buildPrintHtml(template.title, body)

  return new Response(fullHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
