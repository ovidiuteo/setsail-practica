import { Users } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import UsersManager from './UsersManager'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const { data: users } = await supabase
    .from('ssyt_admin_users_list')
    .select('*')
    .order('full_name')
    .limit(500)

  const { data: signupRequests } = await supabase
    .from('ssyt_signup_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div className="px-8 py-8 max-w-[1400px]">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Administrare</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          <Users size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          Useri și conturi
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {users?.length || 0} participanți · {users?.filter((u: any) => u.user_id).length || 0} cu cont · {signupRequests?.length || 0} cereri pending
        </p>
      </div>

      <UsersManager initialUsers={users || []} initialSignupRequests={signupRequests || []} />
    </div>
  )
}
