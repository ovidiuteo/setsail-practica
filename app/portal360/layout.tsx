import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = { title: 'Portal cursant · SetSail' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0A1628' }

export default function Portal360Layout({ children }: { children: React.ReactNode }) {
  return children
}
