import RadioLandingView from './RadioLandingView'
import { getRadioContentCached } from '@/lib/radio-landing/server'
import { getNextRadioSessionTokens, applyTokens } from '@/lib/radio-landing/next-session'

export const revalidate = 300

export default async function RadioLandingPage() {
  const [content, tokens] = await Promise.all([getRadioContentCached(), getNextRadioSessionTokens()])
  // datele seriei care urmează înlocuiesc placeholderele din texte
  return <RadioLandingView content={applyTokens(content, tokens)} />
}
