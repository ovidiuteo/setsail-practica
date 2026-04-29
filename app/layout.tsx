import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SetSail — Practică',
  description: 'Platformă de gestionare examene practice SetSail',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  )
}
