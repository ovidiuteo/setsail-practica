import Link from 'next/link'
import SignupForm from './SignupForm'

export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg p-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#0a1628' }}>
          Cont nou
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Înscrie-te în SSYT2026. Dacă figurezi deja ca participant, te legăm automat de profilul tău.
        </p>

        <SignupForm />

        <div className="mt-6 pt-6 border-t text-center text-sm" style={{ borderColor: '#e5e7eb' }}>
          <span className="text-gray-500">Ai deja cont? </span>
          <Link href="/ssyt/login" className="font-medium hover:underline" style={{ color: '#FF6B35' }}>
            Autentifică-te
          </Link>
        </div>
      </div>
    </div>
  )
}
