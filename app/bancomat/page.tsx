'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, Anchor, Ship, ArrowRight, CornerDownLeft, RotateCcw } from 'lucide-react'

type Result = { email: string; token: string; amount: number }
type Phase = 'input' | 'validated' | 'cashed'

const VOUCHER_EXP = '17.06.2026'

export default function BancomatPage() {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [phase, setPhase] = useState<Phase>('input')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  // contor vizite bancomat (o dată / sesiune de browser).
  useEffect(() => {
    try {
      if (!sessionStorage.getItem('bancomat_visit')) {
        sessionStorage.setItem('bancomat_visit', '1')
        fetch('/api/bancomat/track', {
          method: 'POST', keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'visit' }),
        }).catch(() => {})
      }
    } catch {}
  }, [])

  // Pasul 1 — butonul verde de enter validează emailul și încarcă creditul.
  async function validate() {
    const e = email.trim()
    if (!e || e.indexOf('@') === -1) { setErr('Introdu o adresă de email validă.'); return }
    setLoading(true); setErr(''); setCopied(false)
    try {
      const res = await fetch('/api/voucher/public', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: e, website }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'A apărut o eroare.'); setLoading(false); return }
      setResult({ email: json.email, token: json.token, amount: json.amount })
      setPhase('validated')
    } catch {
      setErr('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  // Pasul 2 — eliberează bancnota și golește creditul.
  function cashout() {
    if (phase !== 'validated') return
    setPhase('cashed')
    // contor cashout + marchează voucherul ca „cheltuit" în log.
    try {
      fetch('/api/bancomat/track', {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'cashout', email: result?.email }),
      }).catch(() => {})
    } catch {}
  }

  function restart() {
    setPhase('input'); setEmail(''); setResult(null); setErr(''); setCopied(false)
  }

  async function copyToken() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const spendHref = result
    ? `/curs-radio-gmdss-lrc?voucher=${encodeURIComponent(result.token)}&email=${encodeURIComponent(result.email)}`
    : '#'

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 text-white"
      style={{ background: 'radial-gradient(120% 120% at 50% 0%,#0e3a63 0%,#06203c 55%,#041527 100%)' }}
    >
      <style>{`
        @keyframes ss-dispense {
          0%   { transform: translateY(-58%) scaleY(.6); opacity: 0; }
          55%  { transform: translateY(8%)   scaleY(1);  opacity: 1; }
          100% { transform: translateY(0)    scaleY(1);  opacity: 1; }
        }
        @keyframes ss-slotglow {
          0%,100% { box-shadow: inset 0 6px 14px rgba(0,0,0,.7); }
          50%     { box-shadow: inset 0 6px 14px rgba(0,0,0,.7), 0 0 22px rgba(245,200,66,.55); }
        }
        .ss-note-out { animation: ss-dispense .9s cubic-bezier(.22,1,.36,1) both; }
        .ss-slot-active { animation: ss-slotglow 1.1s ease-in-out 2; }
      `}</style>

      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2.5 mb-2">
          <div className="rounded-lg p-1.5" style={{ background: '#f5c842' }}>
            <Ship size={18} style={{ color: '#0a1628' }} />
          </div>
          <span className="font-extrabold tracking-wide text-lg">SETSAIL</span>
          <span className="text-[10px] tracking-[0.3em] text-[#9fd8f0]">NAUTICSCHOOL</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black">Bancomatul de vouchere</h1>
        <p className="text-sm text-white/60 mt-1.5 max-w-md mx-auto">
          Introdu adresa ta de email și retrage un voucher de 20&nbsp;EUR pentru cursul Radio GMDSS / LRC. (Un voucher/email/pers)
        </p>
      </div>

      {/* ATM */}
      <div className="w-full max-w-md">
        <div
          className="relative rounded-[28px] p-5 sm:p-6 shadow-2xl"
          style={{
            background: 'linear-gradient(160deg,#2b3a4c 0%,#1b2735 50%,#121b26 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* căști difuzoare decor */}
          <div className="absolute right-5 top-5 flex gap-1.5">
            {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
          </div>

          {/* ECRAN */}
          <div
            className="rounded-2xl p-5 mb-5 border border-white/10"
            style={{ background: 'linear-gradient(135deg,#0a2a4e 0%,#0e3a63 55%,#15527e 100%)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`text-[10px] tracking-[0.25em] ${phase === 'validated' ? 'text-white font-semibold' : 'text-white/60'}`}
                style={phase === 'validated' ? { textShadow: '0 0 8px rgba(255,255,255,0.55)' } : undefined}
              >
                {phase === 'input' ? 'VOUCHER ATM' : (
                  <>CREDIT ATM <span className="font-bold" style={phase === 'cashed' ? { color: '#fb923c' } : undefined}>{phase === 'cashed' ? 0 : result?.amount}€</span></>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ONLINE
              </span>
            </div>

            {phase !== 'cashed' && (
              <>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Adresa ta de email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (phase === 'validated') { setPhase('input'); setResult(null) } }}
                    onKeyDown={(e) => { if (e.key === 'Enter') validate() }}
                    placeholder="nume@exemplu.ro"
                    autoFocus
                    className="flex-1 rounded-lg bg-[#06203c]/70 border border-white/15 px-3.5 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#5cc2ea] focus:border-transparent"
                  />
                  {/* buton verde de enter, ca la PIN-ul de bancomat */}
                  <button
                    onClick={validate}
                    disabled={loading}
                    aria-label="Validează emailul"
                    className={`shrink-0 w-12 rounded-lg text-white flex items-center justify-center transition disabled:opacity-60 ${phase === 'validated' ? 'bg-emerald-600' : 'bg-emerald-500 hover:bg-emerald-400'} shadow-[0_0_0_3px_rgba(16,185,129,0.18)]`}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : phase === 'validated' ? <Check size={20} strokeWidth={2.5} /> : <CornerDownLeft size={20} strokeWidth={2.5} />}
                  </button>
                </div>
                {/* honeypot ascuns */}
                <input
                  className="hidden" tabIndex={-1} autoComplete="off" aria-hidden
                  value={website} onChange={(e) => setWebsite(e.target.value)}
                />
                {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
              </>
            )}

            {phase === 'cashed' && (
              <div className="text-center py-1">
                <p className="text-[11px] tracking-[0.2em] text-white/60">VOUCHER ELIBERAT</p>
                <p className="text-5xl font-black mt-1" style={{ color: '#f5c842' }}>
                  {result?.amount}<span className="text-3xl align-top">€</span>
                </p>
                <p className="text-xs text-white/60 mt-1">Ia bancnota din fanta de mai jos 👇</p>
              </div>
            )}
          </div>

          {/* BUTON */}
          {phase === 'cashed' ? (
            <button
              onClick={restart}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold py-3.5 rounded-xl transition"
            >
              <RotateCcw size={18} /> Restart
            </button>
          ) : (
            <button
              onClick={cashout}
              disabled={phase !== 'validated'}
              className="w-full flex items-center justify-center gap-2 bg-[#f5b528] hover:brightness-95 text-[#0a2a4e] font-bold py-3.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cashout Credit
            </button>
          )}

          {/* FANTA DISPENSER */}
          <div className="mt-5">
            <div
              className={`h-3 rounded-full bg-[#05101d] ${phase === 'cashed' ? 'ss-slot-active' : ''}`}
              style={{ boxShadow: 'inset 0 6px 14px rgba(0,0,0,.7)' }}
            />
          </div>
        </div>

        {/* BANCNOTA dispensată */}
        {phase === 'cashed' && result && (
          <div className="mt-5 ss-note-out">
            <Banknote token={result.token} email={result.email} amount={result.amount} />

            <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
              <a
                href={spendHref}
                className="flex-1 flex items-center justify-center gap-2 bg-[#f5b528] hover:brightness-95 text-[#0a2a4e] font-bold px-5 py-3.5 rounded-xl transition"
              >
                Achită parțial cursul Radio <ArrowRight size={18} />
              </a>
              <button
                onClick={copyToken}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold px-5 py-3.5 rounded-xl transition"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiat!' : 'Copiază codul'}
              </button>
            </div>

            <p className="text-center text-xs text-white/40 mt-3">
              Codul e valabil la înscriere doar cu adresa <span className="font-mono text-white/60">{result.email}</span>. Exp {VOUCHER_EXP}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

function Banknote({ token, email, amount }: { token: string; email: string; amount: number }) {
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-xl text-white select-none"
      style={{
        aspectRatio: '2 / 1',
        background: 'linear-gradient(135deg,#0a2a4e 0%,#0e3a63 38%,#1f6f9e 72%,#2ea8d8 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg,rgba(255,255,255,0.12) 0 2px,transparent 2px 9px),radial-gradient(circle at 80% 20%,rgba(255,255,255,0.22),transparent 45%)',
        }}
      />
      <Anchor className="absolute -right-5 -bottom-6 text-white/10" style={{ width: 150, height: 150 }} strokeWidth={1} />

      <div className="relative h-full flex flex-col justify-between p-5 sm:p-6">
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

        <div>
          <p className="text-[10px] tracking-[0.25em] text-white/60 mb-1">COD VOUCHER</p>
          <p className="font-mono font-bold tracking-[0.15em] text-2xl sm:text-3xl drop-shadow">{token}</p>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-[10px] sm:text-[11px] text-white/70 max-w-[60%] leading-tight">
            Curs Radio GMDSS / LRC · reducere {amount} EUR · exp {VOUCHER_EXP}
          </p>
          <p className="text-[10px] sm:text-[11px] text-white/60 font-mono truncate max-w-[40%] text-right">{email}</p>
        </div>
      </div>
    </div>
  )
}
