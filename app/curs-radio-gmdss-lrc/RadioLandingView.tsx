'use client'

import { useEffect, useState } from 'react'
import {
  Anchor, Menu, X, Loader2, Check, ArrowRight, Phone, Mail, Send, MapPin,
  Radio, Satellite, LifeBuoy, Languages, ShieldAlert, Wifi, GraduationCap,
  Ship, Globe, Waves, CalendarDays, Video, ClipboardList, AlertTriangle,
} from 'lucide-react'
import type { RadioContent } from '@/lib/radio-landing/content'

const mono = 'font-[family-name:var(--font-mono)]'
const COVERAGE_ICONS = [Radio, Satellite, LifeBuoy, Languages]
const WHY_ICONS = [Anchor, ShieldAlert, Wifi, GraduationCap]
const FORWHOM_ICONS = [Ship, Globe, GraduationCap, Waves]

const BrandFacebook = (p: { className?: string }) => (<svg className={p.className} fill="currentColor" viewBox="0 0 24 24"><path d="M13 22v-9h3l.5-3.5H13V7.5c0-1 .3-1.7 1.8-1.7H16.5V2.7C16.2 2.6 15 2.5 13.7 2.5c-2.7 0-4.5 1.6-4.5 4.6v2.4H6v3.5h3.2V22z" /></svg>)
const BrandInstagram = (p: { className?: string }) => (<svg className={p.className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.5.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.2.6.4 1.3.5 2.3 0 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.5 2.3-.2.6-.5 1.1-1 1.6-.5.5-1 .8-1.6 1-.6.2-1.3.4-2.3.5-1.1 0-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.5-.6-.2-1.1-.5-1.6-1-.5-.5-.8-1-1-1.6-.2-.6-.4-1.3-.5-2.3C2 15 2 14.7 2 12s0-3 .1-4.1c0-1 .2-1.7.5-2.3.2-.6.5-1.1 1-1.6.5-.5 1-.8 1.6-1 .6-.2 1.3-.4 2.3-.5C9 2 9.3 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zM17.8 7a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z" /></svg>)
const BrandYoutube = (p: { className?: string }) => (<svg className={p.className} fill="currentColor" viewBox="0 0 24 24"><path d="M23 12s0-3.5-.4-5.1a2.7 2.7 0 00-1.9-1.9C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.7.5a2.7 2.7 0 00-1.9 1.9C1 8.5 1 12 1 12s0 3.5.4 5.1a2.7 2.7 0 001.9 1.9c1.8.5 8.7.5 8.7.5s6.9 0 8.7-.5a2.7 2.7 0 001.9-1.9C23 15.5 23 12 23 12zM9.8 15.3V8.7l5.7 3.3z" /></svg>)
const BRANDS = [BrandFacebook, BrandInstagram, BrandYoutube]
const BAR_HEIGHTS = [40, 70, 55, 90, 65, 30, 80]

export default function RadioLandingView({ content: c }: { content: RadioContent }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const openForm = () => setFormOpen(true)

  useEffect(() => {
    try {
      if (!sessionStorage.getItem('radio_visit')) {
        sessionStorage.setItem('radio_visit', '1')
        fetch('/api/radio-landing/track', { method: 'POST', keepalive: true }).catch(() => {})
      }
    } catch {}
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="bg-[#06203c] text-white scroll-smooth">
      {/* NAV */}
      <header className="border-b border-white/10 sticky top-0 z-40 bg-[#06203c]/90 backdrop-blur">
        <nav className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
          <a href="#hero" className="flex items-center gap-2.5 text-white">
            <Anchor className="w-7 h-7" strokeWidth={1.6} />
            <b className="tracking-wide">{c.nav.brandTitle}</b>
            <span className={`${mono} text-[10px] text-[#5cc2ea]/70 ml-1`}>/ {c.nav.brandSubtitle}</span>
          </a>
          <ul className="hidden lg:flex items-center gap-7 text-[13px] font-semibold text-white/80">
            {c.nav.links.map((l, i) => <li key={i}><a href={l.href} className="hover:text-[#5cc2ea] transition">{l.label}</a></li>)}
          </ul>
          <div className="flex items-center gap-3">
            <button onClick={openForm} className="hidden sm:inline-flex bg-[#f5b528] text-[#0a2a4e] font-bold text-[13px] px-5 py-2 rounded-md hover:brightness-95 transition">{c.nav.cta}</button>
            <button onClick={() => setMenuOpen((v) => !v)} className="lg:hidden p-2" aria-label="Meniu"><Menu className="w-6 h-6" /></button>
          </div>
        </nav>
        {menuOpen && (
          <div className="lg:hidden border-t border-white/10 px-5 py-4 space-y-3 text-sm font-semibold">
            {c.nav.links.map((l, i) => <a key={i} href={l.href} className="block" onClick={() => setMenuOpen(false)}>{l.label}</a>)}
            <button onClick={() => { setMenuOpen(false); openForm() }} className="block w-full text-center bg-[#f5b528] text-[#0a2a4e] font-bold py-2.5 rounded-md">{c.nav.cta}</button>
          </div>
        )}
      </header>

      {/* HERO split */}
      <section id="hero" className="radio-hero radio-grid">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="reveal">
            <p className={`${mono} text-[#5cc2ea] text-xs mb-5`}>// {c.hero.eyebrow}</p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.07] tracking-tight">
              {c.hero.titleLine1}<br />{c.hero.titleLine2}<br /><span className="text-[#5cc2ea]">{c.hero.titleAccent}</span>
            </h1>
            <p className="text-white/70 text-lg mt-6 max-w-lg">{c.hero.subtitle}</p>
            <div className="mt-8 flex gap-3 flex-wrap">
              <button onClick={openForm} className="bg-[#f5b528] text-[#0a2a4e] font-bold px-7 py-3.5 rounded-lg hover:brightness-95 transition">{c.hero.ctaPrimary}</button>
              <a href="#program" className="border border-white/25 px-7 py-3.5 rounded-lg font-semibold hover:bg-white/5 transition">{c.hero.ctaSecondary}</a>
            </div>
            <div className={`${mono} mt-8 grid grid-cols-3 gap-4 text-xs text-white/55 max-w-md`}>
              {c.hero.stats.map((s, i) => (
                <div key={i}><div className="text-2xl font-bold text-white">{s.value}</div>{s.label}</div>
              ))}
            </div>
          </div>

          {/* console card */}
          <div className="reveal rounded-2xl bg-[#081a30] border border-white/10 shadow-2xl p-6 max-w-md mx-auto w-full" style={{ transitionDelay: '0.1s' }}>
            <div className={`${mono} flex items-center justify-between text-[11px] text-white/50 mb-4`}>
              <span>{c.hero.console.title}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 radio-blink" />ON AIR</span>
            </div>
            <div className="rounded-lg bg-[#04111f] border border-[#2ea8d8]/20 p-4 mb-4">
              <div className="flex items-end justify-between">
                <div><div className={`${mono} text-[10px] text-[#5cc2ea]/60`}>CHANNEL</div><div className={`${mono} text-4xl font-bold text-[#5cc2ea]`}>{c.hero.console.channel}</div></div>
                <div className={`${mono} text-right text-[10px] text-white/50`}>{c.hero.console.mmsiLabel}<br /><span className="text-white">{c.hero.console.mmsi}</span></div>
              </div>
              <div className="mt-3 flex items-end gap-1 h-8">
                {BAR_HEIGHTS.map((h, i) => <div key={i} className="w-[5px] rounded-[2px] bg-[#5cc2ea]" style={{ height: `${h}%` }} />)}
              </div>
            </div>
            <div className={`${mono} grid grid-cols-4 gap-2 text-[10px] text-center`}>
              {c.hero.console.chips.map((chip, i) => <div key={i} className="bg-white/5 rounded py-2.5 border border-white/10">{chip}</div>)}
            </div>
            <button onClick={openForm} className="mt-3 w-full bg-red-600 hover:bg-red-700 rounded-lg py-3 font-bold tracking-wide text-sm flex items-center justify-center gap-2 transition">
              <AlertTriangle className="w-4 h-4" /> {c.hero.console.distressLabel}
            </button>
          </div>
        </div>
      </section>

      {/* COVERAGE */}
      <section id="despre" className="bg-white text-[#0a2a4e] py-20">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className={`${mono} text-[#2ea8d8] text-xs font-bold mb-2 reveal`}>// {c.coverage.eyebrow}</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-10 reveal">{c.coverage.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
            {c.coverage.items.map((it, i) => {
              const Icon = COVERAGE_ICONS[i] || Radio
              return (
                <div key={i} className="bg-white p-6 reveal" style={{ transitionDelay: `${i * 0.07}s` }}>
                  <div className="w-11 h-11 rounded-lg bg-[#eef4fb] text-[#2ea8d8] flex items-center justify-center mb-4"><Icon className="w-6 h-6" strokeWidth={1.7} /></div>
                  <h3 className="font-bold mb-1">{it.title}</h3>
                  <p className="text-sm text-slate-500">{it.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section id="program" className="bg-[#0a2a4e] py-24">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className={`${mono} text-[#5cc2ea] text-xs font-bold text-center mb-3 reveal`}>// {c.timeline.eyebrow}</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-center mb-16 reveal">{c.timeline.title}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {c.timeline.days.map((day, i) => {
              const last = i === c.timeline.days.length - 1
              return (
                <div key={i} className={`reveal rounded-2xl border backdrop-blur p-7 ${last ? 'border-[#f5b528]/30 bg-[#f5b528]/[0.06]' : 'border-white/10 bg-white/[0.04]'}`} style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-xl font-extrabold ${last ? 'bg-[#f5b528]/20 text-[#f5b528]' : 'bg-[#2ea8d8]/15 text-[#5cc2ea]'}`}>{i + 1}</div>
                  <h3 className="font-bold text-xl mb-3">{day.title}</h3>
                  <ul className="space-y-1.5 text-white/60 text-sm">
                    {day.items.map((it, k) => <li key={k}>• {it}</li>)}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* BENEFITS + WHY */}
      <section id="beneficii" className="bg-white text-[#0a2a4e] py-24">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-14 lg:gap-20 items-start">
          <div className="reveal">
            <p className={`${mono} text-[#2ea8d8] text-xs font-bold mb-2`}>// {c.benefits.eyebrow}</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-8">{c.benefits.title}</h2>
            <ul className="space-y-4">
              {c.benefits.items.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-[#0a2a4e] text-white flex items-center justify-center mt-0.5"><Check className="w-4 h-4" strokeWidth={3} /></span>
                  <p className="text-lg text-slate-700">{item}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {c.benefits.why.map((w, i) => {
              const Icon = WHY_ICONS[i] || Anchor
              return (
                <div key={i} className="reveal rounded-2xl border border-slate-100 bg-[#eef4fb]/60 p-6" style={{ transitionDelay: `${i * 0.08}s` }}>
                  <div className="w-11 h-11 rounded-xl bg-white shadow-sm text-[#2ea8d8] flex items-center justify-center mb-4"><Icon className="w-6 h-6" strokeWidth={1.7} /></div>
                  <h4 className="font-bold mb-1.5">{w.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{w.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FOR WHOM */}
      <section className="bg-[#eef4fb] text-[#0a2a4e] py-20">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className={`${mono} text-[#2ea8d8] text-xs font-bold text-center mb-10 reveal`}>// {c.forWhom.eyebrow}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {c.forWhom.cards.map((card, i) => {
              const Icon = FORWHOM_ICONS[i] || Ship
              return (
                <div key={i} className="reveal text-center" style={{ transitionDelay: `${i * 0.08}s` }}>
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-sm text-[#0a2a4e] flex items-center justify-center mx-auto mb-4"><Icon className="w-7 h-7" strokeWidth={1.5} /></div>
                  <h4 className="font-bold mb-1.5">{card.title}</h4>
                  <p className="text-sm text-slate-500">{card.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ENROLL */}
      <section id="inscriere" className="bg-[#06203c] py-24 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#2ea8d8]/10 rounded-full blur-3xl" />
        <div className="max-w-7xl mx-auto px-5 lg:px-8 relative grid lg:grid-cols-3 gap-8 items-stretch">
          <div className="reveal">
            <p className={`${mono} text-[#5cc2ea] text-xs font-bold mb-5`}>// {c.enroll.eyebrow}</p>
            <p className="text-5xl lg:text-6xl font-black leading-none whitespace-pre-line">{c.enroll.dateBig}</p>
            <p className="text-white/70 text-lg mt-5">{c.enroll.dateSub}</p>
            <div className="mt-8 space-y-3 text-white/70 text-sm">
              {c.enroll.points.map((p, i) => (
                <p key={i} className="flex items-center gap-3">
                  {i === c.enroll.points.length - 1 ? <MapPin className="w-5 h-5 text-[#f5b528] shrink-0" strokeWidth={1.6} /> : <Check className="w-5 h-5 text-[#5cc2ea] shrink-0" strokeWidth={2.5} />}
                  <span className={i === c.enroll.points.length - 1 ? 'text-[#f5b528] font-semibold' : ''}>{p}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="reveal bg-white text-[#0a2a4e] rounded-2xl shadow-2xl p-8" style={{ transitionDelay: '0.1s' }}>
            <h3 className="text-2xl font-extrabold mb-6">{c.enroll.cardTitle}</h3>
            <ul className="space-y-4 mb-7">
              {c.enroll.cardPoints.map((p, i) => {
                const Icon = [CalendarDays, Video, ClipboardList][i] || CalendarDays
                return <li key={i} className="flex items-center gap-3 text-slate-700"><Icon className="w-5 h-5 text-[#2ea8d8] shrink-0" strokeWidth={1.7} /> {p}</li>
              })}
            </ul>
            <div className="bg-[#eef4fb] rounded-xl p-4 mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Investiție</p>
                <p className="text-3xl font-black text-[#0a2a4e] leading-tight">{c.enroll.priceValue} <span className="text-sm font-medium text-slate-400">{c.enroll.priceUnit}</span></p>
              </div>
              <span className="text-xs bg-[#f5b528]/20 text-[#e0a014] font-bold px-2.5 py-1 rounded-full">{c.enroll.priceBadge}</span>
            </div>
            <p className="text-xs text-slate-400 mb-5">{c.enroll.priceNote}</p>
            <button onClick={openForm} className="block w-full text-center bg-[#f5b528] hover:brightness-95 text-[#0a2a4e] font-bold tracking-wide py-4 rounded-xl transition">{c.enroll.ctaLabel}</button>
            <p className="text-center text-xs text-slate-400 mt-4">{c.enroll.ctaNote}</p>
          </div>

          <div className="reveal rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-8 flex flex-col" style={{ transitionDelay: '0.2s' }}>
            <span className="w-14 h-14 rounded-2xl bg-[#5cc2ea]/15 text-[#5cc2ea] flex items-center justify-center mb-6"><Radio className="w-8 h-8" strokeWidth={1.5} /></span>
            <h3 className="text-2xl font-extrabold mb-5">{c.enroll.bonusTitle}</h3>
            <ul className="space-y-4 text-white/80 text-sm">
              {c.enroll.bonusItems.map((b, i) => <li key={i} className="flex items-center gap-3"><Check className="w-4 h-4 text-[#5cc2ea] shrink-0" strokeWidth={3} /> {b}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS (initials, no photos) */}
      <section className="bg-white text-[#0a2a4e] py-24">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className={`${mono} text-[#2ea8d8] text-xs font-bold text-center mb-2 reveal`}>// {c.testimonials.eyebrow}</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-center mb-14 reveal">{c.testimonials.title}</h2>
          <div className="grid md:grid-cols-3 gap-7">
            {c.testimonials.items.map((t, i) => (
              <figure key={i} className="reveal bg-[#eef4fb]/60 border border-slate-100 rounded-2xl p-8" style={{ transitionDelay: `${i * 0.08}s` }}>
                <div className="flex gap-1 text-[#f5b528] mb-5">★★★★★</div>
                <blockquote className="text-slate-700 leading-relaxed">„{t.quote}”</blockquote>
                <figcaption className="flex items-center gap-3 mt-6">
                  <span className="w-11 h-11 rounded-full bg-[#0a2a4e] text-white font-bold flex items-center justify-center text-sm">{(t.name || '?').slice(0, 1)}</span>
                  <div><p className="font-bold text-sm">{t.name}</p><p className="text-xs text-slate-500">{t.city}</p></div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="radio-hero radio-grid py-24">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center reveal">
          <p className={`${mono} text-[#5cc2ea] text-xs font-bold mb-5`}>// {c.finalCta.eyebrow}</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">{c.finalCta.title}</h2>
          <p className="text-white/70 text-lg mt-6 max-w-2xl mx-auto">{c.finalCta.subtitle}</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={openForm} className="inline-flex items-center justify-center gap-3 bg-[#f5b528] hover:brightness-95 text-[#0a2a4e] font-bold tracking-wide px-9 py-4 rounded-xl transition">
              {c.finalCta.ctaLabel} <ArrowRight className="w-5 h-5" strokeWidth={2.2} />
            </button>
            <a href={`tel:${c.finalCta.phone.replace(/\s/g, '')}`} className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold px-8 py-4 rounded-xl transition">
              <Phone className="w-5 h-5" strokeWidth={1.8} /> {c.finalCta.phone}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="bg-[#06203c] text-white/70 pt-20 pb-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 pb-14 border-b border-white/10">
            <div>
              <div className="flex items-center gap-3 text-white mb-5">
                <Anchor className="w-8 h-8" strokeWidth={1.6} />
                <span><span className="block font-extrabold text-lg leading-none">{c.footer.brandTitle}</span><span className="block text-[10px] tracking-[0.3em] text-[#5cc2ea]/80">{c.footer.brandSubtitle}</span></span>
              </div>
              <p className="text-sm leading-relaxed">{c.footer.about}</p>
              <div className="flex gap-3 mt-5">
                {BRANDS.map((Icon, i) => <a key={i} href="#" className="w-9 h-9 rounded-lg bg-white/10 hover:bg-[#2ea8d8] flex items-center justify-center transition" aria-label="Social"><Icon className="w-4 h-4" /></a>)}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm tracking-wide mb-5">{c.footer.linksTitle}</h4>
              <ul className="space-y-3 text-sm">
                {c.nav.links.map((l, i) => <li key={i}><a href={l.href} className="hover:text-[#5cc2ea] transition capitalize">{l.label.toLowerCase()}</a></li>)}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm tracking-wide mb-5">{c.footer.infoTitle}</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> {c.footer.address}</li>
                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> {c.footer.phone}</li>
                <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> {c.footer.email}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm tracking-wide mb-5">{c.footer.newsletterTitle}</h4>
              <p className="text-sm mb-4">{c.footer.newsletterText}</p>
              <form className="flex" onSubmit={(e) => e.preventDefault()}>
                <input type="email" placeholder="Emailul tău" className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-l-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#2ea8d8]" />
                <button className="bg-[#2ea8d8] hover:bg-[#5cc2ea] text-white px-4 rounded-r-lg transition" aria-label="Abonează-te"><Send className="w-5 h-5" strokeWidth={1.8} /></button>
              </form>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-white/50">
            <p>{c.footer.copyright}</p>
            <div className="flex gap-6"><a href="#" className="hover:text-white transition">Termeni și condiții</a><a href="#" className="hover:text-white transition">Confidențialitate</a></div>
          </div>
        </div>
      </footer>

      {/* STICKY MOBILE CTA */}
      <button onClick={openForm} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#f5b528] text-[#0a2a4e] font-bold text-center py-4 shadow-[0_-6px_20px_rgba(0,0,0,0.15)]">
        {c.hero.ctaPrimary} →
      </button>

      {formOpen && <LeadModal content={c} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function LeadModal({ content: c, onClose }: { content: RadioContent; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending'); setErr('')
    try {
      const res = await fetch('/api/radio-landing/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'A apărut o eroare.'); setState('error'); return }
      setState('done')
    } catch { setErr('Conexiune eșuată. Încearcă din nou.'); setState('error') }
  }

  const input = 'w-full border border-slate-200 rounded-lg px-4 py-3 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8] focus:border-transparent'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#06203c]/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white text-[#0a2a4e] rounded-2xl shadow-2xl w-full max-w-md p-7 max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700" aria-label="Închide"><X className="w-5 h-5" /></button>
        {state === 'done' ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8" strokeWidth={2.5} /></div>
            <h3 className="text-2xl font-extrabold mb-2">{c.leadForm.successTitle}</h3>
            <p className="text-slate-500">{c.leadForm.successMsg}</p>
            <button onClick={onClose} className="mt-6 bg-[#0a2a4e] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#103a66] transition">Închide</button>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-extrabold mb-1">{c.leadForm.title}</h3>
            <p className="text-slate-500 text-sm mb-5">{c.leadForm.subtitle}</p>
            <form onSubmit={submit} className="space-y-3">
              <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{c.leadForm.nameLabel}</label>
                <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{c.leadForm.phoneLabel}</label>
                  <input className={input} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{c.leadForm.emailLabel}</label>
                  <input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{c.leadForm.messageLabel}</label>
                <textarea className={input} rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              {state === 'error' && <p className="text-sm text-red-600">{err}</p>}
              <button type="submit" disabled={state === 'sending'} className="w-full flex items-center justify-center gap-2 bg-[#f5b528] hover:brightness-95 text-[#0a2a4e] font-bold py-3.5 rounded-xl transition disabled:opacity-60">
                {state === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : null}{c.leadForm.submitLabel}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
