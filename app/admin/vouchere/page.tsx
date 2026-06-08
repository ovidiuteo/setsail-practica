'use client'

import { useState } from 'react'
import { Loader2, Copy, Check, Anchor, Ship, Mail, Ticket } from 'lucide-react'

type Result = { email: string; token: string; amount: number }

export default function VouchereAdminPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  async function generate() {
    const e = email.trim()
    if (!e || e.indexOf('@') === -1) { setErr('Introdu un email valid.'); setState('error'); return }
    setState('loading'); setErr(''); setCopied(false)
    try {
      const res = await fetch('/api/voucher', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'Eroare la generare.'); setState('error'); return }
      setResult({ email: json.email, token: json.token, amount: json.amount })
      setState('idle')
    } catch {
      setErr('Conexiune eșuată.'); setState('error')
    }
  }

  async function copyToken() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="rounded-lg p-1.5" style={{ background: '#f5c842' }}>
          <Ticket size={18} style={{ color: '#0a1628' }} />
        </div>
        <h1 className="text-2xl font-extrabold text-[#0a2a4e]">Vouchere 20 EUR</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Codul e derivat determinist din adresa de email. Aceeași adresă produce mereu același cod;
        validarea înscrierii se face manual din tabelul de lead-uri.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <label className="block text-xs font-medium text-slate-500 mb-1">Email cursant</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') generate() }}
              placeholder="nume@exemplu.ro"
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8] focus:border-transparent"
            />
          </div>
          <button
            onClick={generate}
            disabled={state === 'loading'}
            className="flex items-center gap-2 bg-[#0a2a4e] hover:brightness-110 text-white font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {state === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
            Generează
          </button>
        </div>
        {state === 'error' && <p className="text-sm text-red-600 mt-2">{err}</p>}
      </div>

      {result && (
        <div className="mt-7">
          <Banknote token={result.token} email={result.email} amount={result.amount} />
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={copyToken}
              className="flex items-center gap-2 bg-[#2ea8d8] hover:brightness-110 text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiat!' : 'Copiază token'}
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-3">
            Trimite banknota / codul cursantului. La înscrierea pe landing page, codul ajunge în tabelul
            de lead-uri pentru validare manuală.
          </p>
        </div>
      )}
    </div>
  )
}

function Banknote({ token, email, amount }: { token: string; email: string; amount: number }) {
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-xl text-white select-none"
      style={{
        aspectRatio: '2 / 1',
        background:
          'linear-gradient(135deg,#0a2a4e 0%,#0e3a63 38%,#1f6f9e 72%,#2ea8d8 100%)',
      }}
    >
      {/* textură guilloché subtilă */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg,rgba(255,255,255,0.12) 0 2px,transparent 2px 9px),radial-gradient(circle at 80% 20%,rgba(255,255,255,0.22),transparent 45%)',
        }}
      />
      {/* filigran ancoră */}
      <Anchor className="absolute -right-5 -bottom-6 text-white/10" style={{ width: 150, height: 150 }} strokeWidth={1} />

      <div className="relative h-full flex flex-col justify-between p-5 sm:p-6">
        {/* top */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-1.5" style={{ background: '#f5c842' }}>
              <Ship size={16} style={{ color: '#0a1628' }} />
            </div>
            <div className="leading-none">
              <p className="font-extrabold tracking-tight text-sm sm:text-base">SETSAIL</p>
              <p className="text-[9px] sm:text-[10px] tracking-[0.3em] text-[#9fd8f0]">NAUTICSCHOOL</p>
            </div>
          </div>
          <div className="text-right leading-none">
            <p className="text-[10px] tracking-[0.25em] text-white/70">VOUCHER</p>
            <p className="text-4xl sm:text-5xl font-black" style={{ color: '#f5c842' }}>
              {amount}<span className="text-2xl sm:text-3xl align-top">€</span>
            </p>
          </div>
        </div>

        {/* cod */}
        <div>
          <p className="text-[10px] tracking-[0.25em] text-white/60 mb-1">COD VOUCHER</p>
          <p className="font-mono font-bold tracking-[0.15em] text-2xl sm:text-3xl drop-shadow">{token}</p>
        </div>

        {/* bottom */}
        <div className="flex items-end justify-between">
          <p className="text-[10px] sm:text-[11px] text-white/70 max-w-[60%] leading-tight">
            Curs Radio GMDSS / LRC · reducere {amount} EUR
          </p>
          <p className="text-[10px] sm:text-[11px] text-white/60 font-mono truncate max-w-[40%] text-right">{email}</p>
        </div>
      </div>
    </div>
  )
}
