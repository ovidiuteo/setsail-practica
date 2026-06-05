import LandingView from './LandingView'
import { getLandingContentCached } from '@/lib/cds-landing/server'

// ISR: the page is served from cache and the DB content read is cached for 5
// minutes (and tagged), so repeated/poller traffic does NOT re-read the DB on
// every request. Edits are pushed live instantly via revalidate on save.
export const revalidate = 300

export default async function CursYachtingCDSPage() {
  const content = await getLandingContentCached()
  return <LandingView content={content} />
}
