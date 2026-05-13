'use client'
import { useState } from 'react'
import { Copy, ExternalLink, Check, Link as LinkIcon } from 'lucide-react'

export default function PublicLinkBar({
  publicPath,
  label = 'Pagina publică',
}: {
  publicPath: string  // ex: "/ssyt/regattas/friendship-regatta"
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  // URL absolut: in dev = localhost, in prod = setsail-practica.vercel.app
  // Folosim window.location.origin pentru a fi corect indiferent de mediu
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const fullUrl = origin + publicPath

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback pentru browsere fara permissions
      const ta = document.createElement('textarea')
      ta.value = fullUrl
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className="rounded-lg flex items-center gap-2 px-3 py-2 mb-4 text-xs"
      style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.2)' }}
    >
      <LinkIcon size={14} style={{ color: '#FF6B35' }} className="flex-shrink-0" />
      <span className="text-gray-500 font-medium uppercase tracking-wider hidden sm:inline">{label}:</span>
      <code
        className="flex-1 min-w-0 truncate font-mono"
        style={{ color: '#0a1628' }}
        title={fullUrl}
      >
        {fullUrl || publicPath}
      </code>
      <button
        onClick={copyToClipboard}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition hover:opacity-80 whitespace-nowrap"
        style={{
          background: copied ? '#10B981' : '#fff',
          color: copied ? '#fff' : '#0a1628',
          border: '1px solid ' + (copied ? '#10B981' : '#e5e7eb'),
        }}
        title="Copiază URL-ul"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        <span>{copied ? 'Copiat!' : 'Copiază'}</span>
      </button>
      <a
        href={publicPath}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-white transition hover:opacity-90 whitespace-nowrap"
        style={{ background: '#FF6B35' }}
        title="Deschide în tab nou"
      >
        <ExternalLink size={12} />
        <span className="hidden sm:inline">Deschide</span>
      </a>
    </div>
  )
}
