import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function adminClient() {
  return createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function verifyAdmin(authHeader: string | null) {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const admin = adminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  const { data: adminRow } = await admin
    .from('ssyt_admin_users')
    .select('level')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!adminRow) return null
  return { user, level: adminRow.level }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const admin = await verifyAdmin(authHeader)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action, participantId, email, password, level, redirectTo, requestId, linkToParticipantId, newParticipantData, reviewNotes } = body
  const supabase = adminClient()

  try {
    // === CREATE USER pentru un participant existent ===
    if (action === 'create_user') {
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('id, email, full_name, user_id')
        .eq('id', participantId)
        .maybeSingle()

      if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
      if (participant.user_id) return NextResponse.json({ error: 'Participant already has an account' }, { status: 400 })

      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4).toUpperCase() + '!1'

      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: participant.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: participant.full_name },
      })
      if (createErr || !newUser.user) return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })

      await supabase.from('ssyt_participants').update({
        user_id: newUser.user.id,
        auth_status: 'invited',
      }).eq('id', participant.id)

      return NextResponse.json({
        success: true,
        userId: newUser.user.id,
        email: participant.email,
        tempPassword,
      })
    }

    // === GENEREAZA LINK pentru primul login ===
    if (action === 'generate_invite_link') {
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('email, user_id, full_name')
        .eq('id', participantId)
        .maybeSingle()
      if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
      if (!participant.user_id) return NextResponse.json({ error: 'User not created yet. Click "Create account" first.' }, { status: 400 })

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: participant.email,
        options: {
          redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://setsail-practica.vercel.app'}/ssyt/set-password`,
        },
      })
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

      return NextResponse.json({
        success: true,
        link: linkData.properties.action_link,
        email: participant.email,
      })
    }

    // === UPDATE EMAIL ===
    if (action === 'update_email') {
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('user_id')
        .eq('id', participantId)
        .maybeSingle()
      if (!participant?.user_id) return NextResponse.json({ error: 'User not created yet' }, { status: 400 })

      const { error: updErr } = await supabase.auth.admin.updateUserById(participant.user_id, {
        email,
        email_confirm: true,
      })
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

      await supabase.from('ssyt_participants').update({ email }).eq('id', participantId)
      return NextResponse.json({ success: true })
    }

    // === SUSPEND / REACTIVATE ===
    if (action === 'suspend' || action === 'reactivate') {
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('user_id')
        .eq('id', participantId)
        .maybeSingle()
      if (!participant?.user_id) return NextResponse.json({ error: 'User not created yet' }, { status: 400 })

      const isSuspend = action === 'suspend'
      const { error: updErr } = await supabase.auth.admin.updateUserById(participant.user_id, {
        ban_duration: isSuspend ? '876000h' : 'none',
      })
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

      await supabase.from('ssyt_participants').update({
        auth_status: isSuspend ? 'suspended' : 'active',
      }).eq('id', participantId)

      return NextResponse.json({ success: true })
    }

    // === DELETE account ===
    if (action === 'delete_account') {
      if (admin.level !== 'super_admin') {
        return NextResponse.json({ error: 'Only super_admin can delete accounts' }, { status: 403 })
      }
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('user_id')
        .eq('id', participantId)
        .maybeSingle()
      if (!participant?.user_id) return NextResponse.json({ error: 'No account to delete' }, { status: 400 })

      const { error: delErr } = await supabase.auth.admin.deleteUser(participant.user_id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

      await supabase.from('ssyt_participants').update({
        user_id: null,
        auth_status: 'no_account',
      }).eq('id', participantId)
      return NextResponse.json({ success: true })
    }

    // === SET ADMIN LEVEL ===
    if (action === 'set_admin_level') {
      if (admin.level !== 'super_admin') {
        return NextResponse.json({ error: 'Only super_admin can change admin roles' }, { status: 403 })
      }
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('user_id')
        .eq('id', participantId)
        .maybeSingle()
      if (!participant?.user_id) return NextResponse.json({ error: 'User not created yet' }, { status: 400 })

      if (!level || level === 'none' || level === '') {
        await supabase.from('ssyt_admin_users').delete().eq('user_id', participant.user_id)
      } else {
        await supabase.from('ssyt_admin_users').upsert({
          user_id: participant.user_id,
          level,
        }, { onConflict: 'user_id' })
      }
      return NextResponse.json({ success: true })
    }

    // === APROBA signup request - leg de participant existent ===
    if (action === 'approve_request_existing') {
      const { data: req } = await supabase
        .from('ssyt_signup_requests')
        .select('id, user_id, email, full_name, phone, status')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 400 })
      if (!linkToParticipantId) return NextResponse.json({ error: 'Missing linkToParticipantId' }, { status: 400 })

      // Verific ca participantul exista si nu are deja user_id
      const { data: targetParticipant } = await supabase
        .from('ssyt_participants')
        .select('id, user_id, email')
        .eq('id', linkToParticipantId)
        .maybeSingle()
      if (!targetParticipant) return NextResponse.json({ error: 'Target participant not found' }, { status: 404 })
      if (targetParticipant.user_id) return NextResponse.json({ error: 'Participantul are deja cont legat' }, { status: 400 })

      // Leg user-ul de participant, update email cu cel real, status active
      await supabase.from('ssyt_participants').update({
        user_id: req.user_id,
        email: req.email,  // suprascriu placeholder cu email real
        phone: req.phone || targetParticipant.email,
        auth_status: 'active',
      }).eq('id', linkToParticipantId)

      // Confirm email-ul in auth.users
      await supabase.auth.admin.updateUserById(req.user_id, { email_confirm: true })

      // Marchez cererea aprobată
      await supabase.from('ssyt_signup_requests').update({
        status: 'approved',
        linked_participant_id: linkToParticipantId,
        reviewed_by: admin.user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Aprobat și legat de participant existent',
      }).eq('id', requestId)

      return NextResponse.json({ success: true })
    }

    // === APROBA signup request - creez participant nou ===
    if (action === 'approve_request_new') {
      const { data: req } = await supabase
        .from('ssyt_signup_requests')
        .select('id, user_id, email, full_name, phone, status')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 400 })

      // Sparg numele in first+last (ultimul cuvant = last_name, restul = first)
      const parts = req.full_name.trim().split(/\s+/)
      const last_name = parts.length > 1 ? parts[parts.length - 1] : parts[0]
      const first_name = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''

      // Creez participantul nou
      const { data: newParticipant, error: createErr } = await supabase
        .from('ssyt_participants')
        .insert({
          first_name: first_name || req.full_name,
          last_name: last_name || '—',
          email: req.email,
          phone: req.phone,
          user_id: req.user_id,
          auth_status: 'active',
          status: 'active',
          consent_gdpr: true,
          notes: 'Creat din signup_request aprobat',
          ...(newParticipantData || {}),
        })
        .select('id, full_name')
        .single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

      // Confirm email-ul
      await supabase.auth.admin.updateUserById(req.user_id, { email_confirm: true })

      // Marchez cererea
      await supabase.from('ssyt_signup_requests').update({
        status: 'approved',
        linked_participant_id: newParticipant.id,
        reviewed_by: admin.user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Aprobat ca participant nou',
      }).eq('id', requestId)

      return NextResponse.json({ success: true, participantId: newParticipant.id, participantName: newParticipant.full_name })
    }

    // === RESPINGE signup request ===
    if (action === 'reject_request') {
      const { data: req } = await supabase
        .from('ssyt_signup_requests')
        .select('id, user_id, status')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 400 })

      // Marchez cererea
      await supabase.from('ssyt_signup_requests').update({
        status: 'rejected',
        reviewed_by: admin.user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Respins',
      }).eq('id', requestId)

      // Optional: sterg si contul Supabase
      const { deleteAccount } = body
      if (deleteAccount) {
        await supabase.auth.admin.deleteUser(req.user_id)
      } else {
        // Doar ban
        await supabase.auth.admin.updateUserById(req.user_id, { ban_duration: '876000h' })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}