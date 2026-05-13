'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from './supabase-browser'

export type CurrentUser = {
  user: any | null
  isAdmin: boolean
  adminLevel: string | null
  participant: any | null
  loading: boolean
}

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    user: null, isAdmin: false, adminLevel: null, participant: null, loading: true,
  })

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let mounted = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) setState({ user: null, isAdmin: false, adminLevel: null, participant: null, loading: false })
        return
      }

      const [adminRes, participantRes] = await Promise.all([
        supabase.from('ssyt_admin_users').select('level').eq('user_id', user.id).maybeSingle(),
        supabase.from('ssyt_participants').select('id, full_name, first_name, last_name, email, phone, photo_url').eq('user_id', user.id).maybeSingle(),
      ])

      if (mounted) {
        setState({
          user,
          isAdmin: !!adminRes.data,
          adminLevel: (adminRes.data as any)?.level || null,
          participant: participantRes.data,
          loading: false,
        })
      }
    }

    load()

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        load()
      }
    })

    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  return state
}

// Hook care redirect-eaza daca nu e logat
export function useRequireAuth(redirectTo: string = '/ssyt/login') {
  const user = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (!user.loading && !user.user) {
      router.push(redirectTo + '?next=' + encodeURIComponent(window.location.pathname))
    }
  }, [user.loading, user.user, redirectTo, router])

  return user
}
