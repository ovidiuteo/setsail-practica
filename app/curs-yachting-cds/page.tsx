import LandingView from './LandingView'
import { getLandingContent } from '@/lib/cds-landing/server'

// Content is DB-driven and editable from the admin editor → always fresh.
export const dynamic = 'force-dynamic'

export default async function CursYachtingCDSPage() {
  const content = await getLandingContent()
  return <LandingView content={content} />
}
