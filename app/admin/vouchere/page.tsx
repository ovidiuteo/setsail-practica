'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, Anchor, Ship, Mail, Ticket, Eye, Zap, Wallet, RefreshCw, Save, Settings } from 'lucide-react'
import type { VoucherConfig } from '@/lib/voucher-config'

type Result = { email: string; token: string; amount: number }
type VoucherRow = { email: string; token: string; amount: number; cashed: boolean; created_at: string; cashed_at: string | null }
type Stats = { bancomat: { visit: number; generate: number; cashout: number }; vouchers: VoucherRow[] }

function fmtCut(c: string): string { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : c }

export default function VouchereAdminPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [cfg, setCfg] = useState<VoucherConfig | null>(null)
  const [cfgSaving, setCfgSaving] = useState(false)
  const [cfgMsg, setCfgMsg] = useState('')
  const [tab, setTab] = useState<'stats' | 'info'>('stats')

  async function loadStats() {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/voucher/stats', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.ok) setStats({ bancomat: json.bancomat, vouchers: json.vouchers })
    } catch {}
    setStatsLoading(false)
  }
  async function loadConfig() {
    try {
      const res = await fetch('/api/voucher/config', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.ok) setCfg(json.config)
    } catch {}
  }
  useEffect(() => { loadStats(); loadConfig() }, [])

  async function saveConfig() {
    if (!cfg) return
    setCfgSaving(true); setCfgMsg('')
    try {
      const res = await fetch('/api/voucher/config', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg),
      })
      const json = await res.json()
      if (res.ok && json.ok) { setCfg(json.config); setCfgMsg('Salvat ✓') }
      else setCfgMsg(json.error || 'Eroare la salvare.')
    } catch { setCfgMsg('Conexiune eșuată.') }
    setCfgSaving(false)
    setTimeout(() => setCfgMsg(''), 2500)
  }
  const setF = (k: keyof VoucherConfig, v: any) => setCfg((c) => (c ? { ...c, [k]: v } : c))

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
      <div className="flex items-center gap-2.5 mb-4">
        <div className="rounded-lg p-1.5" style={{ background: '#f5c842' }}>
          <Ticket size={18} style={{ color: '#0a1628' }} />
        </div>
        <h1 className="text-2xl font-extrabold text-[#0a2a4e]">VOUCHERE SETSAIL</h1>
      </div>

      {/* TABURI */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {([['stats', 'Statistici și lead-uri'], ['info', 'Info']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition ${tab === key ? 'border-[#2ea8d8] text-[#0a2a4e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
      <>
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
          <Banknote token={result.token} email={result.email} amount={result.amount} desc={cfg?.banknoteDesc || ''} exp={cfg ? fmtCut(cfg.cutoff) : ''} />
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

      {/* CONFIGURARE PROGRAM (bancomat) */}
      <div className="mt-10 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={16} className="text-[#2ea8d8]" />
          <h2 className="text-lg font-extrabold text-[#0a2a4e]">Configurare program bancomat</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Personalizează valoarea, textele și data de expirare/închidere a bancomatului public.
        </p>

        {!cfg ? (
          <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Se încarcă…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Valoare voucher (EUR)</label>
                <input type="number" min={0} value={cfg.amount}
                  onChange={(e) => setF('amount', Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dată închidere / expirare (OUT OF ORDER din această zi)</label>
                <input type="date" value={cfg.cutoff}
                  onChange={(e) => setF('cutoff', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
                <p className="text-[11px] text-slate-400 mt-1">Afișat ca „Exp {fmtCut(cfg.cutoff)}".</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Titlu pagină</label>
              <input value={cfg.pageTitle} onChange={(e) => setF('pageTitle', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subtitlu pagină</label>
              <textarea rows={2} value={cfg.pageSubtitle} onChange={(e) => setF('pageSubtitle', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Text buton „cheltuie"</label>
                <input value={cfg.ctaLabel} onChange={(e) => setF('ctaLabel', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Link buton (unde duce)</label>
                <input value={cfg.spendUrl} onChange={(e) => setF('spendUrl', e.target.value)} placeholder="/curs-radio-gmdss-lrc"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Descriere pe bancnotă</label>
              <input value={cfg.banknoteDesc} onChange={(e) => setF('banknoteDesc', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
              <p className="text-[11px] text-slate-400 mt-1">Apare ca „{cfg.banknoteDesc} {cfg.amount} EUR · exp {fmtCut(cfg.cutoff)}".</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mesaj OUT OF ORDER</label>
              <textarea rows={2} value={cfg.outOfOrderText} onChange={(e) => setF('outOfOrderText', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8]" />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={saveConfig} disabled={cfgSaving}
                className="flex items-center gap-2 bg-[#0a2a4e] hover:brightness-110 text-white font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-60">
                {cfgSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvează
              </button>
              {cfgMsg && <span className={`text-sm ${cfgMsg.includes('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{cfgMsg}</span>}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {tab === 'stats' && (
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-[#0a2a4e]">Bancomat — statistici</h2>
          <button onClick={loadStats} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0a2a4e] transition">
            <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} /> Reîmprospătează
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Eye, label: 'Vizite bancomat', value: stats?.bancomat.visit, color: '#2ea8d8' },
            { icon: Zap, label: 'Coduri generate', value: stats?.bancomat.generate, color: '#0a2a4e' },
            { icon: Wallet, label: 'Cashout Credit', value: stats?.bancomat.cashout, color: '#f5b528' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <Icon size={18} style={{ color }} />
              <p className="text-2xl font-extrabold text-[#0a2a4e] mt-2 leading-none">
                {statsLoading && value === undefined ? '—' : (value ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-bold text-[#0a2a4e] mt-6 mb-2">
          Vouchere generate la bancomat {stats?.vouchers ? `(${stats.vouchers.length})` : ''}
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {statsLoading && !stats ? (
            <p className="text-sm text-slate-400 p-4 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Se încarcă…</p>
          ) : !stats?.vouchers?.length ? (
            <p className="text-sm text-slate-400 p-4">Niciun voucher generat încă.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-3 py-2 font-semibold">Email</th>
                    <th className="px-3 py-2 font-semibold">Cod</th>
                    <th className="px-3 py-2 font-semibold">Cashout</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.vouchers.map((v) => (
                    <tr key={v.email} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 text-[#0a2a4e] font-medium">{v.email}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{v.token}</td>
                      <td className="px-3 py-2">
                        {v.cashed
                          ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">cheltuit</span>
                          : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">doar generat</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(v.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Toate voucherele expiră după {cfg ? fmtCut(cfg.cutoff) : '…'}.</p>
      </div>
      )}
    </div>
  )
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  } catch { return iso }
}

function Banknote({ token, email, amount, desc, exp }: { token: string; email: string; amount: number; desc: string; exp: string }) {
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
            {desc} {amount} EUR · exp {exp}
          </p>
          <p className="text-[10px] sm:text-[11px] text-white/60 font-mono truncate max-w-[40%] text-right">{email}</p>
        </div>
      </div>
    </div>
  )
}
