import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'SETSAIL GMDSS/LRC — Curs radiocomunicații maritime online pe Zoom',
  description:
    'Certificat radio GMDSS / LRC: VHF, MF/HF, DSC, EPIRB, SART și proceduri GMDSS. Obligatoriu pentru a opera stația de la bord și pentru charter. 100% online, 15–17 iunie.',
  openGraph: {
    title: 'Curs radio GMDSS / LRC — online pe Zoom, 15–17 iunie',
    description: 'Certificatul radio obligatoriu pentru a opera stația și a închiria iahturi în străinătate. 3 seri online.',
    type: 'website',
  },
}

export default function RadioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${mono.variable} font-[family-name:var(--font-inter)] text-[#0a2a4e] antialiased`}>
      {children}
    </div>
  )
}
