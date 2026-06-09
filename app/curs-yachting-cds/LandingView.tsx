'use client'

import { useEffect, useState } from 'react'
import {
  Globe, Sailboat, CalendarDays, ArrowRight, Menu, Ship, GraduationCap,
  BookOpen, Anchor, Navigation, Flag, Check, Waves, Users, Award,
  Compass, MapPin, Gift, Star, Phone, Mail, ChevronDown, X, Loader2,
} from 'lucide-react'
import type { LandingContent } from '@/lib/cds-landing/content'
import NewsletterForm from '@/components/NewsletterForm'

const display = 'font-[family-name:var(--font-playfair)]'

const BENEFIT_ICONS = [Globe, Sailboat, CalendarDays]
const VALUE_ICONS = [Sailboat, Award, GraduationCap]
const TIMELINE_ICONS = [BookOpen, Anchor, Navigation, Flag]
const WHY_ICONS = [Waves, Sailboat, Users, Award]
const FORWHOM_ICONS = [Users, Compass, Ship, GraduationCap]

// Brand icons (removed from lucide-react) — inline SVG
const BrandFacebook = (p: { className?: string }) => (
  <svg className={p.className} fill="currentColor" viewBox="0 0 24 24"><path d="M13 22v-9h3l.5-3.5H13V7.5c0-1 .3-1.7 1.8-1.7H16.5V2.7C16.2 2.6 15 2.5 13.7 2.5c-2.7 0-4.5 1.6-4.5 4.6v2.4H6v3.5h3.2V22z" /></svg>
)
const BrandInstagram = (p: { className?: string }) => (
  <svg className={p.className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.5.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.2.6.4 1.3.5 2.3 0 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.5 2.3-.2.6-.5 1.1-1 1.6-.5.5-1 .8-1.6 1-.6.2-1.3.4-2.3.5-1.1 0-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.5-.6-.2-1.1-.5-1.6-1-.5-.5-.8-1-1-1.6-.2-.6-.4-1.3-.5-2.3C2 15 2 14.7 2 12s0-3 .1-4.1c0-1 .2-1.7.5-2.3.2-.6.5-1.1 1-1.6.5-.5 1-.8 1.6-1 .6-.2 1.3-.4 2.3-.5C9 2 9.3 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zM17.8 7a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z" /></svg>
)
const BrandYoutube = (p: { className?: string }) => (
  <svg className={p.className} fill="currentColor" viewBox="0 0 24 24"><path d="M23 12s0-3.5-.4-5.1a2.7 2.7 0 00-1.9-1.9C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.7.5a2.7 2.7 0 00-1.9 1.9C1 8.5 1 12 1 12s0 3.5.4 5.1a2.7 2.7 0 001.9 1.9c1.8.5 8.7.5 8.7.5s6.9 0 8.7-.5a2.7 2.7 0 001.9-1.9C23 15.5 23 12 23 12zM9.8 15.3V8.7l5.7 3.3z" /></svg>
)
const BRANDS = [BrandFacebook, BrandInstagram, BrandYoutube]

export default function LandingView({ content: c }: { content: LandingContent }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    // visit beacon — count once per browser session (page is cached, so the
    // server doesn't run on every hit; we track real client views instead)
    try {
      if (!sessionStorage.getItem('cds_visit')) {
        sessionStorage.setItem('cds_visit', '1')
        fetch('/api/cds-landing/track', { method: 'POST', keepalive: true }).catch(() => {})
      }
    } catch { /* ignore */ }

    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    onScroll()
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect() }
  }, [])

  const openForm = () => setFormOpen(true)

  const heroBg = {
    background:
      `linear-gradient(100deg, rgba(6,32,60,0.94) 0%, rgba(8,38,70,0.78) 38%, rgba(10,42,78,0.30) 68%, rgba(10,42,78,0.10) 100%), url('${c.hero.image}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
  const finalBg = {
    background: `linear-gradient(120deg, rgba(6,32,60,0.92), rgba(10,42,78,0.78)), url('${c.finalCta.image}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }

  return (
    <div className="bg-white text-[#0a2a4e] scroll-smooth">
      {/* ============== NAVBAR ============== */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#06203c]/95 backdrop-blur shadow-lg' : ''}`}>
        <nav className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <a href="#hero" className="flex items-center gap-3 text-white">
              <Anchor className="w-8 h-8" strokeWidth={1.6} />
              <span className="leading-none">
                <span className="block font-extrabold tracking-wide text-lg">{c.nav.brandTitle}</span>
                <span className="block text-[10px] tracking-[0.3em] text-[#5cc2ea]/90 font-medium">{c.nav.brandSubtitle}</span>
              </span>
            </a>
            <ul className="hidden lg:flex items-center gap-8 text-[13px] font-semibold tracking-wide text-white/90">
              {c.nav.links.map((l, i) => (
                <li key={i}><a href={l.href} className="hover:text-[#5cc2ea] transition">{l.label}</a></li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <button onClick={openForm} className="hidden sm:inline-flex items-center gap-2 bg-white/10 hover:bg-white text-white hover:text-[#0a2a4e] border border-white/25 backdrop-blur px-5 py-2.5 rounded-lg text-[13px] font-bold tracking-wide transition">
                {c.nav.cta}
              </button>
              <button onClick={() => setMenuOpen((v) => !v)} className="lg:hidden text-white p-2" aria-label="Meniu"><Menu className="w-7 h-7" /></button>
            </div>
          </div>
        </nav>
        {menuOpen && (
          <div className="lg:hidden bg-[#06203c]/98 backdrop-blur border-t border-white/10">
            <ul className="px-6 py-5 space-y-4 text-white font-semibold text-sm tracking-wide">
              {c.nav.links.map((l, i) => (
                <li key={i}><a href={l.href} className="block" onClick={() => setMenuOpen(false)}>{l.label}</a></li>
              ))}
              <li className="pt-2">
                <button onClick={() => { setMenuOpen(false); openForm() }} className="block w-full text-center bg-[#f5b528] text-[#0a2a4e] font-bold py-3 rounded-lg">{c.nav.cta}</button>
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* ============== HERO ============== */}
      <section id="hero" className="relative min-h-screen flex items-center" style={heroBg}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8 w-full pt-28 pb-20">
          <div className="max-w-2xl">
            <p className="tracking-[0.28em] text-[#5cc2ea] font-semibold text-xs sm:text-sm mb-6">{c.hero.eyebrow}</p>
            <h1 className={`${display} text-white text-5xl sm:text-6xl lg:text-[4.4rem] leading-[1.05] font-bold`}>
              {c.hero.titleLine1}<br />{c.hero.titleLine2}
              <span className="block text-[#5cc2ea] italic mt-2">{c.hero.titleAccent}</span>
            </h1>
            <p className="text-white/85 text-lg sm:text-xl mt-7 leading-relaxed max-w-xl">{c.hero.subtitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-10">
              {c.hero.benefits.map((b, i) => {
                const Icon = BENEFIT_ICONS[i] || Globe
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="shrink-0 w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#5cc2ea]"><Icon className="w-6 h-6" strokeWidth={1.6} /></span>
                    <span className="text-white text-sm leading-tight font-medium">{b.title}<br /><span className="text-white/60 font-normal">{b.sub}</span></span>
                  </div>
                )
              })}
            </div>
            <div className="mt-11 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button onClick={openForm} className="group inline-flex items-center gap-3 bg-[#f5b528] hover:bg-[#e0a014] text-[#0a2a4e] font-bold tracking-wide px-8 py-4 rounded-xl shadow-[0_14px_34px_-8px_rgba(245,181,40,0.55)] transition-all hover:-translate-y-0.5">
                {c.hero.ctaLabel}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" strokeWidth={2.2} />
              </button>
              <span className="text-white/70 text-sm flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />{c.hero.urgency}</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 cds-floaty hidden sm:block"><ChevronDown className="w-6 h-6" /></div>
      </section>

      {/* ============== VALUE ============== */}
      <section id="despre" className="py-24 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-3xl mx-auto reveal">
            <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-4">{c.value.eyebrow}</p>
            <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold leading-tight`}>{c.value.title}</h2>
            <p className="text-slate-500 text-lg mt-5">{c.value.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-10 mt-16">
            {c.value.cards.map((card, i) => {
              const Icon = VALUE_ICONS[i] || Sailboat
              return (
                <article key={i} className="reveal group text-center" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div className="relative w-40 h-40 mx-auto mb-7">
                    <img src={card.image} alt={card.title} className="w-full h-full object-cover rounded-full ring-4 ring-[#eef4fb] shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)] group-hover:scale-105 transition duration-500" />
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-[#0a2a4e] text-[#5cc2ea] flex items-center justify-center shadow-lg ring-4 ring-white"><Icon className="w-6 h-6" strokeWidth={1.6} /></span>
                  </div>
                  <h3 className={`${display} text-2xl font-bold text-[#0a2a4e] mb-3`}>{card.title}</h3>
                  <p className="text-slate-500 leading-relaxed px-2">{card.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============== TIMELINE ============== */}
      <section id="structura" className="py-24 lg:py-28 bg-[#eef4fb]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-3xl mx-auto reveal">
            <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-4">{c.timeline.eyebrow}</p>
            <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold leading-tight`}>{c.timeline.title}</h2>
          </div>
          <div className="relative mt-20">
            <div className="hidden lg:block absolute top-7 left-[12.5%] right-[12.5%] h-[3px] cds-tl-line rounded-full" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
              {c.timeline.days.map((day, i) => {
                const Icon = TIMELINE_ICONS[i] || BookOpen
                const last = i === c.timeline.days.length - 1
                return (
                  <div key={i} className="reveal text-center lg:text-left" style={{ transitionDelay: `${i * 0.1}s` }}>
                    <div className="flex lg:block items-center gap-4 mb-5">
                      <div className={`relative z-10 w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)] mx-auto lg:mx-0 ${last ? 'bg-[#0a2a4e] border-2 border-[#f5b528]' : 'bg-white border-2 border-[#2ea8d8]'}`}>
                        <span className={`text-[9px] font-bold leading-none ${last ? 'text-[#5cc2ea]' : 'text-slate-400'}`}>ZIUA</span>
                        <span className={`text-lg font-extrabold leading-none ${last ? 'text-white' : 'text-[#0a2a4e]'}`}>{i + 1}</span>
                      </div>
                    </div>
                    <div className={`mb-3 ${last ? 'text-[#f5b528]' : 'text-[#2ea8d8]'}`}><Icon className="w-8 h-8 mx-auto lg:mx-0" strokeWidth={1.5} /></div>
                    <h3 className="font-bold text-[#0a2a4e] text-lg mb-3">{day.title}</h3>
                    <ul className="space-y-1.5 text-slate-500 text-sm">
                      {day.items.map((it, k) => <li key={k}>• {it}</li>)}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============== BENEFITS + WHY ============== */}
      <section id="beneficii" className="py-24 lg:py-28 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <div className="reveal">
              <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-4">{c.benefits.eyebrow}</p>
              <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold mb-8`}>{c.benefits.title}</h2>
              <ul className="space-y-5">
                {c.benefits.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[#0a2a4e] text-white flex items-center justify-center mt-0.5"><Check className="w-4 h-4" strokeWidth={3} /></span>
                    <p className="text-lg text-slate-700">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="reveal relative" style={{ transitionDelay: '0.15s' }}>
              <img src={c.benefits.image} alt={c.benefits.title} className="w-full h-[440px] object-cover rounded-3xl shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)]" />
              <div className="absolute -bottom-8 -left-6 sm:-left-10 bg-white rounded-2xl shadow-[0_24px_60px_-18px_rgba(10,42,78,0.35)] p-5 w-56 hidden sm:block">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-xl bg-[#eef4fb] text-[#0a2a4e] flex items-center justify-center"><Compass className="w-7 h-7" strokeWidth={1.6} /></span>
                  <div>
                    <p className="text-2xl font-extrabold text-[#0a2a4e] leading-none">{c.benefits.badgeValue}</p>
                    <p className="text-xs text-slate-500 mt-1">{c.benefits.badgeLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-28 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {c.benefits.why.map((w, i) => {
              const Icon = WHY_ICONS[i] || Waves
              return (
                <div key={i} className="reveal text-center sm:text-left" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div className="w-12 h-12 rounded-xl bg-[#eef4fb] text-[#0a2a4e] flex items-center justify-center mb-4 mx-auto sm:mx-0"><Icon className="w-7 h-7" strokeWidth={1.6} /></div>
                  <h4 className="font-bold text-[#0a2a4e] mb-2">{w.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{w.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============== FOR WHOM ============== */}
      <section id="cui" className="py-20 bg-[#eef4fb]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-10 text-center">{c.forWhom.eyebrow}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {c.forWhom.cards.map((card, i) => {
              const Icon = FORWHOM_ICONS[i] || Users
              return (
                <div key={i} className="reveal text-center" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)] text-[#0a2a4e] flex items-center justify-center mx-auto mb-4"><Icon className="w-8 h-8" strokeWidth={1.5} /></div>
                  <h4 className="font-bold text-[#0a2a4e] mb-1.5">{card.title}</h4>
                  <p className="text-sm text-slate-500">{card.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============== ENROLL / DATE ============== */}
      <section id="inscriere" className="py-24 lg:py-28 bg-[#06203c] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#2ea8d8]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#2ea8d8]/10 rounded-full blur-3xl" />
        <div className="max-w-7xl mx-auto px-5 lg:px-8 relative">
          <div className="grid lg:grid-cols-3 gap-8 items-stretch">
            <div className="reveal lg:pr-4">
              <p className="tracking-[0.28em] text-[#5cc2ea] font-bold text-xs mb-5">{c.enroll.eyebrow}</p>
              <p className={`${display} text-white text-6xl lg:text-7xl font-bold leading-none whitespace-pre-line`}>{c.enroll.dateBig}</p>
              <p className="text-white/80 text-xl mt-5 font-medium">{c.enroll.dateSub}</p>
              <div className="mt-9 space-y-4 text-white/75 text-sm">
                {c.enroll.points.map((p, i) => (
                  <p key={i} className="flex items-center gap-3">
                    {i === c.enroll.points.length - 1
                      ? <MapPin className="w-5 h-5 text-[#f5b528] shrink-0" strokeWidth={1.6} />
                      : (i === 0 ? <Users className="w-5 h-5 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> : <Award className="w-5 h-5 text-[#5cc2ea] shrink-0" strokeWidth={1.6} />)}
                    <span className={i === c.enroll.points.length - 1 ? 'text-[#f5b528] font-semibold' : ''}>{p}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="reveal bg-white rounded-2xl shadow-[0_24px_60px_-18px_rgba(10,42,78,0.35)] p-8 lg:-mt-4" style={{ transitionDelay: '0.1s' }}>
              <h3 className={`${display} text-2xl font-bold text-[#0a2a4e] mb-6`}>{c.enroll.cardTitle}</h3>
              <ul className="space-y-4 mb-7">
                {c.enroll.cardPoints.map((p, i) => {
                  const Icon = [CalendarDays, Sailboat, MapPin][i] || CalendarDays
                  return <li key={i} className="flex items-center gap-3 text-slate-700"><Icon className="w-5 h-5 text-[#2ea8d8] shrink-0" strokeWidth={1.7} /> {p}</li>
                })}
              </ul>
              <div className="bg-[#eef4fb] rounded-xl p-4 mb-6 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Investiție</p>
                  <p className="text-3xl font-extrabold text-[#0a2a4e] leading-tight">{c.enroll.priceValue} <span className="text-sm font-medium text-slate-400">{c.enroll.priceUnit}</span></p>
                </div>
                <span className="text-xs bg-[#f5b528]/20 text-[#e0a014] font-bold px-2.5 py-1 rounded-full">{c.enroll.priceBadge}</span>
              </div>
              <button onClick={openForm} className="block w-full text-center bg-[#f5b528] hover:bg-[#e0a014] text-[#0a2a4e] font-bold tracking-wide py-4 rounded-xl shadow-[0_14px_34px_-8px_rgba(245,181,40,0.55)] transition hover:-translate-y-0.5">{c.enroll.ctaLabel}</button>
              <p className="text-center text-xs text-slate-400 mt-4">{c.enroll.ctaNote}</p>
            </div>
            <div className="reveal rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-8 flex flex-col" style={{ transitionDelay: '0.2s' }}>
              <span className="w-14 h-14 rounded-2xl bg-[#f5b528]/15 text-[#f5b528] flex items-center justify-center mb-6"><Gift className="w-8 h-8" strokeWidth={1.5} /></span>
              <h3 className={`${display} text-white text-2xl font-bold mb-5`}>{c.enroll.bonusTitle}</h3>
              <ul className="space-y-4 text-white/80 text-sm">
                {c.enroll.bonusItems.map((b, i) => (
                  <li key={i} className="flex items-center gap-3"><Check className="w-4 h-4 text-[#5cc2ea] shrink-0" strokeWidth={3} /> {b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============== TESTIMONIALS ============== */}
      <section id="testimoniale" className="py-24 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-3 text-center">{c.testimonials.eyebrow}</p>
          <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold text-center mb-16`}>{c.testimonials.title}</h2>
          <div className="grid md:grid-cols-3 gap-7">
            {c.testimonials.items.map((t, i) => (
              <figure key={i} className="reveal bg-[#eef4fb]/60 border border-slate-100 rounded-2xl p-8 hover:shadow-[0_24px_60px_-18px_rgba(10,42,78,0.35)] transition" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="flex gap-1 text-[#f5b528] mb-5">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className="w-4 h-4 fill-current" strokeWidth={0} />)}</div>
                <blockquote className="text-slate-700 leading-relaxed">„{t.quote}”</blockquote>
                <figcaption className="flex items-center gap-3 mt-6">
                  <img src={t.image} alt={t.name} className="w-11 h-11 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-[#0a2a4e] text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.city}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="relative py-28 lg:py-32 overflow-hidden">
        <div className="absolute inset-0" style={finalBg} />
        <div className="relative max-w-4xl mx-auto px-5 lg:px-8 text-center reveal">
          <p className="tracking-[0.28em] text-[#5cc2ea] font-bold text-xs mb-5">{c.finalCta.eyebrow}</p>
          <h2 className={`${display} text-white text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight`}>{c.finalCta.title}</h2>
          <p className="text-white/80 text-lg mt-6 max-w-2xl mx-auto">{c.finalCta.subtitle}</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={openForm} className="inline-flex items-center justify-center gap-3 bg-[#f5b528] hover:bg-[#e0a014] text-[#0a2a4e] font-bold tracking-wide px-9 py-4 rounded-xl shadow-[0_14px_34px_-8px_rgba(245,181,40,0.55)] transition hover:-translate-y-0.5">
              {c.finalCta.ctaLabel}
              <ArrowRight className="w-5 h-5" strokeWidth={2.2} />
            </button>
            <a href={`tel:${c.finalCta.phone.replace(/\s/g, '')}`} className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold px-8 py-4 rounded-xl backdrop-blur transition">
              <Phone className="w-5 h-5" strokeWidth={1.8} /> {c.finalCta.phone}
            </a>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer id="contact" className="bg-[#06203c] text-white/70 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 pb-14 border-b border-white/10">
            <div>
              <div className="flex items-center gap-3 text-white mb-5">
                <Anchor className="w-8 h-8" strokeWidth={1.6} />
                <span><span className="block font-extrabold text-lg leading-none">{c.footer.brandTitle}</span><span className="block text-[10px] tracking-[0.3em] text-[#5cc2ea]/80">{c.footer.brandSubtitle}</span></span>
              </div>
              <p className="text-sm leading-relaxed">{c.footer.about}</p>
              <div className="flex gap-3 mt-5">
                {BRANDS.map((Icon, i) => (
                  <a key={i} href="#" className="w-9 h-9 rounded-lg bg-white/10 hover:bg-[#2ea8d8] flex items-center justify-center transition" aria-label="Social"><Icon className="w-4 h-4" /></a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm tracking-wide mb-5">{c.footer.linksTitle}</h4>
              <ul className="space-y-3 text-sm">
                {c.nav.links.slice(0, 5).map((l, i) => (
                  <li key={i}><a href={l.href} className="hover:text-[#5cc2ea] transition capitalize">{l.label.toLowerCase()}</a></li>
                ))}
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
              <NewsletterForm source="cds" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-white/50">
            <p>{c.footer.copyright}</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition">Termeni și condiții</a>
              <a href="#" className="hover:text-white transition">Politica de confidențialitate</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ============== STICKY MOBILE CTA ============== */}
      <button onClick={openForm} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#f5b528] text-[#0a2a4e] font-bold text-center py-4 shadow-[0_-6px_20px_rgba(0,0,0,0.15)]">
        {c.hero.ctaLabel} →
      </button>

      {/* ============== LEAD FORM MODAL ============== */}
      {formOpen && <LeadModal content={c} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function LeadModal({ content: c, onClose }: { content: LandingContent; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending'); setErr('')
    try {
      const res = await fetch('/api/cds-landing/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'A apărut o eroare.'); setState('error'); return }
      setState('done')
    } catch {
      setErr('Conexiune eșuată. Încearcă din nou.'); setState('error')
    }
  }

  const input = 'w-full border border-slate-200 rounded-lg px-4 py-3 text-[#0a2a4e] focus:outline-none focus:ring-2 focus:ring-[#2ea8d8] focus:border-transparent'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#06203c]/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700" aria-label="Închide"><X className="w-5 h-5" /></button>
        {state === 'done' ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8" strokeWidth={2.5} /></div>
            <h3 className={`${display} text-2xl font-bold text-[#0a2a4e] mb-2`}>{c.leadForm.successTitle}</h3>
            <p className="text-slate-500">{c.leadForm.successMsg}</p>
            <button onClick={onClose} className="mt-6 bg-[#0a2a4e] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#103a66] transition">Închide</button>
          </div>
        ) : (
          <>
            <h3 className={`${display} text-2xl font-bold text-[#0a2a4e] mb-1`}>{c.leadForm.title}</h3>
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
              <button type="submit" disabled={state === 'sending'} className="w-full flex items-center justify-center gap-2 bg-[#f5b528] hover:bg-[#e0a014] text-[#0a2a4e] font-bold py-3.5 rounded-xl shadow-[0_14px_34px_-8px_rgba(245,181,40,0.55)] transition disabled:opacity-60">
                {state === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {c.leadForm.submitLabel}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
