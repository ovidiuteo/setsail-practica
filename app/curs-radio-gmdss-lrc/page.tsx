import RadioLandingView from './RadioLandingView'
import { getRadioContentCached } from '@/lib/radio-landing/server'

export const revalidate = 300

export default async function RadioLandingPage() {
  const content = await getRadioContentCached()
  return <RadioLandingView content={content} />
}
