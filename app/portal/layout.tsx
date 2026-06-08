import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Portal Cursant' }

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children
}
