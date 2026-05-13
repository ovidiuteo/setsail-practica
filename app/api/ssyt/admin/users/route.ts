import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: aceasta cheie e SECRETA - doar pe server, NICIODATA in browser
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function adminClient() {
  return createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Verific daca user-ul curent (din auth header) e admin
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
  const { action, participantId, email, password, level, redirectTo } = body
  const supabase = adminClient()

  try {
    // === CREATE USER pentru un participant existent ===
    if (action === 'create_user') {
      // Iau participantul + emailul
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('id, email, full_name, user_id')
        .eq('id', participantId)
        .maybeSingle()

      if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
      if (participant.user_id) return NextResponse.json({ error: 'Participant already has an account' }, { status: 400 })

      // Generez parola temporara aleatoare (16 chars)
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4).toUpperCase() + '!1'

      // Creez user-ul cu email confirmat (skip confirmation)
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: participant.email,
        password: tempPassword,
        email_confirm: true,  // confirma automat
        user_metadata: { full_name: participant.full_name },
      })
      if (createErr || !newUser.user) return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })

      // Leg participantul de user
      await supabase.from('ssyt_participants').update({
        user_id: newUser.user.id,
        auth_status: 'invited',
      }).eq('id', participant.id)

      return NextResponse.json({
        success: true,
        userId: newUser.user.id,
        email: participant.email,
        tempPassword,  // admin il vede o singura data
      })
    }

    // === GENEREAZA LINK pentru primul login (set password) ===
    if (action === 'generate_invite_link') {
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('email, user_id, full_name')
        .eq('id', participantId)
        .maybeSingle()
      if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
      if (!participant.user_id) return NextResponse.json({ error: 'User not created yet. Click "Create account" first.' }, { status: 400 })

      // Folosim generateLink pentru a obtine un link de recovery / invitation
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

    // === UPDATE EMAIL pentru un user ===
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

      // Update si in ssyt_participants
      await supabase.from('ssyt_participants').update({ email }).eq('id', participantId)
      return NextResponse.json({ success: true })
    }

    // === SUSPEND / REACTIVATE user ===
    if (action === 'suspend' || action === 'reactivate') {
      const { data: participant } = await supabase
        .from('ssyt_participants')
        .select('user_id')
        .eq('id', participantId)
        .maybeSingle()
      if (!participant?.user_id) return NextResponse.json({ error: 'User not created yet' }, { status: 400 })

      const isSuspend = action === 'suspend'
      // Supabase admin: ban_duration = 'none' (reactivare) sau o durata
      const { error: updErr } = await supabase.auth.admin.updateUserById(participant.user_id, {
        ban_duration: isSuspend ? '876000h' : 'none',  // 100 ani = suspendat indefinit
      })
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

      await supabase.from('ssyt_participants').update({
        auth_status: isSuspend ? 'suspended' : 'active',
      }).eq('id', participantId)

      return NextResponse.json({ success: true })
    }

    // === DELETE user account (NU si participant) ===
    if (action === 'delete_account') {
      // Doar super_admin poate
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
      // Doar super_admin poate schimba role admin
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
        // Sterg row-ul din ssyt_admin_users
        await supabase.from('ssyt_admin_users').delete().eq('user_id', participant.user_id)
      } else {
        // Upsert
        await supabase.from('ssyt_admin_users').upsert({
          user_id: participant.user_id,
          level,
        }, { onConflict: 'user_id' })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
