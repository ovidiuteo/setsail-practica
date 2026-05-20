import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, IdCard } from 'lucide-react'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'
import IdentityForm from './IdentityForm'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL = 60 * 60 * 24 // 24h

async function makeSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const supabase = getPortalSupabase()
  const { data } = await supabase.storage
    .from('ssyt-participant-uploads')
    .createSignedUrl(path, SIGNED_URL_TTL)
  return data?.signedUrl ?? null
}

export default async function PortalIdentityPage() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login')

  const { participant } = session

  const [ciSignedUrl, signatureSignedUrl] = await Promise.all([
    makeSignedUrl(participant.ci_image_url),
    makeSignedUrl(participant.signature_image_url),
  ])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/ssyt/portal/profile"
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Înapoi la profil
      </Link>

      <div className="mb-6">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: '#0a1628', letterSpacing: '-0.02em' }}
        >
          <IdCard size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          Identitate și semnătură
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Acestea sunt necesare pentru generarea automată a documentelor către cluburile sportive
          (cereri de legitimare, declarații, formulare de adeziune). Datele sunt private și
          accesibile doar pentru tine și administratorii SSYT.
        </p>
      </div>

      <IdentityForm
        hasCiOnServer={!!participant.ci_image_url}
        hasSignatureOnServer={!!participant.signature_image_url}
        ciSignedUrl={ciSignedUrl}
        signatureSignedUrl={signatureSignedUrl}
      />
    </div>
  )
}
