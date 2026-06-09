'use client'

import { useState } from 'react'
import { Send, Check, Loader2 } from 'lucide-react'

// Newsletter signup used in landing footers. Saves to newsletter_subscribers.
export default function NewsletterForm({ source }: { source: string }) {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || state === 'sending') return
    setState('sending')
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source, website }),
      })
      setState('done')
      setEmail('')
    } catch {
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <p className="text-sm text-emerald-300 flex items-center gap-2">
        <Check className="w-4 h-4" /> Te-ai abonat. Mulțumim!
      </p>
    )
  }

  return (
    <form className="flex" onSubmit={submit}>
      <input
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <input
        type="email"
        required
        placeholder="Emailul tău"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-l-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#2ea8d8]"
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        className="bg-[#2ea8d8] hover:bg-[#5cc2ea] text-white px-4 rounded-r-lg transition disabled:opacity-60"
        aria-label="Abonează-te"
      >
        {state === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" strokeWidth={1.8} />}
      </button>
    </form>
  )
}
