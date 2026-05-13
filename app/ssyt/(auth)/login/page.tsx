import { Suspense } from 'react'
import Link from 'next/link'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg p-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#0a1628' }}>
          Bun venit înapoi
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Autentifică-te pentru a accesa portalul.
        </p>

        <Suspense fallback={<div className="text-sm text-gray-400">Se încarcă...</div>}>
          <LoginForm />
        </Suspense>

        <div className="mt-6 pt-6 border-t text-center text-sm" style={{ borderColor: '#e5e7eb' }}>
          <span className="text-gray-500">Cont nou? </span>
          <Link href="/ssyt/signup" className="font-medium hover:underline" style={{ color: '#FF6B35' }}>
            Înregistrează-te
          </Link>
        </div>
        <div className="mt-2 text-center text-sm">
          <Link href="/ssyt/reset-password" className="text-gray-400 hover:text-gray-700">
            Ai uitat parola?
          </Link>
        </div>
      </div>
    </div>
  )
}
