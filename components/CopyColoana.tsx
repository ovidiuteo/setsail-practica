'use client'
import { useState } from 'react'

// Copiază valorile unei coloane, în ordinea în care apar în listă — un rând per
// cursant, gata de lipit în Google Sheets, Excel sau Word.
export default function CopyColoana({ valori, titlu, eticheta = 'copy' }: { valori: string[]; titlu: string; eticheta?: string }) {
  const [copiat, setCopiat] = useState(false)
  return (
    <button type="button" title={titlu}
      onClick={async e => {
        e.stopPropagation()
        const text = valori.join('\n')
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          // pagini fără permisiune de clipboard (ex. http): copiere prin textarea temporar
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        setCopiat(true)
        setTimeout(() => setCopiat(false), 1500)
      }}
      className={`flex items-center gap-0.5 px-1.5 py-1 rounded border normal-case tracking-normal text-[10px] ${
        copiat ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400 hover:text-gray-700'}`}>
      {copiat ? '✓ copiat' : eticheta}
    </button>
  )
}
