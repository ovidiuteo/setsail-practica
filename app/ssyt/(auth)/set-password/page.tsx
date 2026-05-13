import { Suspense } from 'react'
import SetPasswordForm from './SetPasswordForm'

export const dynamic = 'force-dynamic'

export default function SetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg p-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#0a1628' }}>
          Setează parolă
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Bun venit! Stabilește o parolă pentru contul tău.
        </p>

        <Suspense fallback={<div className="text-sm text-gray-400">Se încarcă...</div>}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
