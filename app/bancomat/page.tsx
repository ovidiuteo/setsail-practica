import { getVoucherConfig, isClosed, formatCutoff } from '@/lib/voucher-config'
import BancomatView from './BancomatView'

export const dynamic = 'force-dynamic'

export default async function BancomatPage() {
  const config = await getVoucherConfig()
  return <BancomatView config={config} closed={isClosed(config.cutoff)} expLabel={formatCutoff(config.cutoff)} />
}
