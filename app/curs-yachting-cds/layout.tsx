import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SETSAIL CDS — Curs intensiv yachting (în 4 zile înveți să conduci o barcă)',
  description:
    'Curs intensiv de yachting C+D+S la Limanu, Marea Neagră. 50% teorie + 50% practică reală pe mare. Un skill internațional pe care îl folosești oriunde în lume. 8–11 iunie.',
  openGraph: {
    title: 'Curs intensiv yachting CDS — În 4 zile înveți să conduci o barcă',
    description:
      'Curs intensiv de yachting la Limanu. 50% teorie, 50% practică reală pe mare. 8–11 iunie. Locuri limitate.',
    type: 'website',
  },
}

export default function CursYachtingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${inter.variable} ${playfair.variable} font-[family-name:var(--font-inter)] text-[#0a2a4e] antialiased`}
    >
      {children}
    </div>
  )
}
