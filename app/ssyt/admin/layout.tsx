import type { Metadata } from 'next'
import AdminSidebar from '@/components/ssyt/admin/AdminSidebar'

export const metadata: Metadata = {
  title: 'Admin SSYT2026',
}

export default function SSYTAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      <AdminSidebar />
      <div style={{ marginLeft: 56 }}>{children}</div>
    </div>
  )
}