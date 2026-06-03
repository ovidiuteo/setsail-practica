'use client'

import { useEffect, useState } from 'react'
import {
  Globe, Sailboat, CalendarDays, ArrowRight, Menu, Ship, GraduationCap,
  BookOpen, Anchor, Navigation, Flag, Check, Waves, Users, Award,
  Compass, MapPin, Gift, Star, Phone, Mail, Send, ChevronDown,
} from 'lucide-react'

const display = 'font-[family-name:var(--font-playfair)]'

// Brand icons (removed from lucide-react) — inline SVG
const BrandFacebook = (p: { className?: string }) => (
  <svg className={p.className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M13 22v-9h3l.5-3.5H13V7.5c0-1 .3-1.7 1.8-1.7H16.5V2.7C16.2 2.6 15 2.5 13.7 2.5c-2.7 0-4.5 1.6-4.5 4.6v2.4H6v3.5h3.2V22z" />
  </svg>
)
const BrandInstagram = (p: { className?: string }) => (
  <svg className={p.className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.5.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.2.6.4 1.3.5 2.3 0 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.5 2.3-.2.6-.5 1.1-1 1.6-.5.5-1 .8-1.6 1-.6.2-1.3.4-2.3.5-1.1 0-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.5-.6-.2-1.1-.5-1.6-1-.5-.5-.8-1-1-1.6-.2-.6-.4-1.3-.5-2.3C2 15 2 14.7 2 12s0-3 .1-4.1c0-1 .2-1.7.5-2.3.2-.6.5-1.1 1-1.6.5-.5 1-.8 1.6-1 .6-.2 1.3-.4 2.3-.5C9 2 9.3 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zM17.8 7a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z" />
  </svg>
)
const BrandYoutube = (p: { className?: string }) => (
  <svg className={p.className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M23 12s0-3.5-.4-5.1a2.7 2.7 0 00-1.9-1.9C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.7.5a2.7 2.7 0 00-1.9 1.9C1 8.5 1 12 1 12s0 3.5.4 5.1a2.7 2.7 0 001.9 1.9c1.8.5 8.7.5 8.7.5s6.9 0 8.7-.5a2.7 2.7 0 001.9-1.9C23 15.5 23 12 23 12zM9.8 15.3V8.7l5.7 3.3z" />
  </svg>
)

const FINAL_IMG =
  'https://images.unsplash.com/photo-1540946485063-a40da27545f8?auto=format&fit=crop&w=2000&q=80'

const navLinks = [
  { href: '#despre', label: 'DESPRE NOI' },
  { href: '#structura', label: 'CURSURI' },
  { href: '#beneficii', label: 'PERMIS BARCĂ' },
  { href: '#cui', label: 'FLOTĂ' },
  { href: '#testimoniale', label: 'RECENZII' },
  { href: '#contact', label: 'CONTACT' },
]

export default function CursYachtingCDS() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    onScroll()

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

    return () => {
      window.removeEventListener('scroll', onScroll)
      io.disconnect()
    }
  }, [])

  return (
    <div className="bg-white text-[#0a2a4e] scroll-smooth">
      {/* ============== NAVBAR ============== */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#06203c]/95 backdrop-blur shadow-lg' : ''
        }`}
      >
        <nav className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <a href="#hero" className="flex items-center gap-3 text-white">
              <Anchor className="w-8 h-8" strokeWidth={1.6} />
              <span className="leading-none">
                <span className="block font-extrabold tracking-wide text-lg">SETSAIL</span>
                <span className="block text-[10px] tracking-[0.3em] text-[#5cc2ea]/90 font-medium">
                  YACHTING SCHOOL
                </span>
              </span>
            </a>

            <ul className="hidden lg:flex items-center gap-8 text-[13px] font-semibold tracking-wide text-white/90">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="hover:text-[#5cc2ea] transition">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3">
              <a
                href="#inscriere"
                className="hidden sm:inline-flex items-center gap-2 bg-white/10 hover:bg-white text-white hover:text-[#0a2a4e] border border-white/25 backdrop-blur px-5 py-2.5 rounded-lg text-[13px] font-bold tracking-wide transition"
              >
                ÎNSCRIE-TE ACUM
              </a>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="lg:hidden text-white p-2"
                aria-label="Meniu"
              >
                <Menu className="w-7 h-7" />
              </button>
            </div>
          </div>
        </nav>

        {menuOpen && (
          <div className="lg:hidden bg-[#06203c]/98 backdrop-blur border-t border-white/10">
            <ul className="px-6 py-5 space-y-4 text-white font-semibold text-sm tracking-wide">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="block" onClick={() => setMenuOpen(false)}>
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="pt-2">
                <a
                  href="#inscriere"
                  onClick={() => setMenuOpen(false)}
                  className="block text-center bg-[#f5b528] text-[#0a2a4e] font-bold py-3 rounded-lg"
                >
                  ÎNSCRIE-TE ACUM
                </a>
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* ============== HERO ============== */}
      <section id="hero" className="cds-hero relative min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 w-full pt-28 pb-20">
          <div className="max-w-2xl">
            <p className="tracking-[0.28em] text-[#5cc2ea] font-semibold text-xs sm:text-sm mb-6">
              CURS INTENSIV YACHTING
            </p>

            <h1 className={`${display} text-white text-5xl sm:text-6xl lg:text-[4.4rem] leading-[1.05] font-bold`}>
              În 4 zile înveți să<br />conduci o barcă.
              <span className="block text-[#5cc2ea] italic mt-2">Oriunde în lume.</span>
            </h1>

            <p className="text-white/85 text-lg sm:text-xl mt-7 leading-relaxed max-w-xl">
              Curs intensiv de yachting categoria{' '}
              <span className="font-semibold text-white">C + D + S</span> — teorie + practică reală
              în fiecare zi, la Limanu, Marea Neagră.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-10">
              {[
                { icon: Globe, t: 'Skill internațional', s: 'utilizabil oriunde' },
                { icon: Sailboat, t: '50% teorie', s: '50% practică' },
                { icon: CalendarDays, t: 'Format intensiv', s: 'Luni – Joi' },
              ].map(({ icon: Icon, t, s }) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="shrink-0 w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#5cc2ea]">
                    <Icon className="w-6 h-6" strokeWidth={1.6} />
                  </span>
                  <span className="text-white text-sm leading-tight font-medium">
                    {t}
                    <br />
                    <span className="text-white/60 font-normal">{s}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-11 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <a
                href="#inscriere"
                className="group inline-flex items-center gap-3 bg-[#f5b528] hover:bg-[#e0a014] text-[#0a2a4e] font-bold tracking-wide px-8 py-4 rounded-xl shadow-[0_14px_34px_-8px_rgba(245,181,40,0.55)] transition-all hover:-translate-y-0.5"
              >
                REZERVĂ LOCUL PENTRU 8–11 IUNIE
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" strokeWidth={2.2} />
              </a>
              <span className="text-white/70 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Locuri limitate · grupuri mici
              </span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 cds-floaty hidden sm:block">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* ============== VALUE PROPOSITION ============== */}
      <section id="despre" className="py-24 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-3xl mx-auto reveal">
            <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-4">DE CE SĂ FII SKIPPER?</p>
            <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold leading-tight`}>
              Un skill care îți schimbă libertatea
            </h2>
            <p className="text-slate-500 text-lg mt-5">
              Nu înveți doar „să mergi cu barca”. Câștigi independența de a explora marea oriunde în
              lume — în vacanță, în charter sau într-o carieră.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-10 mt-16">
            {[
              {
                img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
                icon: Sailboat,
                t: 'Vacanțe independente',
                d: 'Navighezi cu familia sau prietenii în cele mai frumoase destinații maritime — fără skipper plătit, în ritmul tău.',
              },
              {
                img: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=400&q=80',
                icon: Award,
                t: 'Lifestyle premium',
                d: 'Libertate totală pe apă. Închiriezi o barcă oriunde în lume și te bucuri de mare ca un lifestyle, nu ca un eveniment rar.',
              },
              {
                img: 'https://images.unsplash.com/photo-1565627866642-f23a05d63d68?auto=format&fit=crop&w=400&q=80',
                icon: GraduationCap,
                t: 'Carieră skipper',
                d: 'Primul pas concret către o carieră în yachting și joburi de skipper plătite, în România și internațional.',
              },
            ].map(({ img, icon: Icon, t, d }, i) => (
              <article key={t} className="reveal group text-center" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="relative w-40 h-40 mx-auto mb-7">
                  <img
                    src={img}
                    alt={t}
                    className="w-full h-full object-cover rounded-full ring-4 ring-[#eef4fb] shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)] group-hover:scale-105 transition duration-500"
                  />
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-[#0a2a4e] text-[#5cc2ea] flex items-center justify-center shadow-lg ring-4 ring-white">
                    <Icon className="w-6 h-6" strokeWidth={1.6} />
                  </span>
                </div>
                <h3 className={`${display} text-2xl font-bold text-[#0a2a4e] mb-3`}>{t}</h3>
                <p className="text-slate-500 leading-relaxed px-2">{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============== COURSE STRUCTURE / TIMELINE ============== */}
      <section id="structura" className="py-24 lg:py-28 bg-[#eef4fb]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-3xl mx-auto reveal">
            <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-4">STRUCTURA CURSULUI</p>
            <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold leading-tight`}>
              4 zile intensive.<br className="sm:hidden" /> Fiecare zi = teorie + practică
            </h2>
          </div>

          <div className="relative mt-20">
            <div className="hidden lg:block absolute top-7 left-[12.5%] right-[12.5%] h-[3px] cds-tl-line rounded-full" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
              {[
                { n: '1', icon: BookOpen, t: 'Bazele navigației', items: ['Elemente de teorie', 'Siguranță pe apă', 'Prim contact cu barca'], last: false },
                { n: '2', icon: Anchor, t: 'Manevre în port', items: ['Control motor și vele', 'Porniri, opriri, viraje', 'Andocare și acostare'], last: false },
                { n: '3', icon: Navigation, t: 'Navigație în larg', items: ['Plecare în larg', 'Comunicații maritime', 'Situații reale pe mare'], last: false },
                { n: '4', icon: Flag, t: 'Simulare completă', items: ['Planificare traseu', 'Exerciții complexe', 'Evaluare și pregătire examen'], last: true },
              ].map(({ n, icon: Icon, t, items, last }, i) => (
                <div key={n} className="reveal text-center lg:text-left" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div className="flex lg:block items-center gap-4 mb-5">
                    <div
                      className={`relative z-10 w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)] mx-auto lg:mx-0 ${
                        last ? 'bg-[#0a2a4e] border-2 border-[#f5b528]' : 'bg-white border-2 border-[#2ea8d8]'
                      }`}
                    >
                      <span className={`text-[9px] font-bold leading-none ${last ? 'text-[#5cc2ea]' : 'text-slate-400'}`}>ZIUA</span>
                      <span className={`text-lg font-extrabold leading-none ${last ? 'text-white' : 'text-[#0a2a4e]'}`}>{n}</span>
                    </div>
                  </div>
                  <div className={`mb-3 ${last ? 'text-[#f5b528]' : 'text-[#2ea8d8]'}`}>
                    <Icon className="w-8 h-8 mx-auto lg:mx-0" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-bold text-[#0a2a4e] text-lg mb-3">{t}</h3>
                  <ul className="space-y-1.5 text-slate-500 text-sm">
                    {items.map((it) => (
                      <li key={it}>• {it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============== WHAT YOU GET + WHY ============== */}
      <section id="beneficii" className="py-24 lg:py-28 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <div className="reveal">
              <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-4">CE PRIMEȘTI LA FINAL</p>
              <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold mb-8`}>Vei putea să:</h2>
              <ul className="space-y-5">
                {[
                  'Conduci o barcă cu velă cu încredere și în siguranță',
                  'Înțelegi navigația și regulile de pe mare',
                  'Aplici regulile de siguranță în condiții reale',
                  'Închiriezi ambarcațiuni în România și în străinătate',
                  'Continui spre certificări avansate și carieră în yachting',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[#0a2a4e] text-white flex items-center justify-center mt-0.5">
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </span>
                    <p className="text-lg text-slate-700">{item}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="reveal relative" style={{ transitionDelay: '0.15s' }}>
              <img
                src="https://images.unsplash.com/photo-1502209524164-acea936639a2?auto=format&fit=crop&w=900&q=80"
                alt="Navigație la Limanu"
                className="w-full h-[440px] object-cover rounded-3xl shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)]"
              />
              <div className="absolute -bottom-8 -left-6 sm:-left-10 bg-white rounded-2xl shadow-[0_24px_60px_-18px_rgba(10,42,78,0.35)] p-5 w-56 hidden sm:block">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-xl bg-[#eef4fb] text-[#0a2a4e] flex items-center justify-center">
                    <Compass className="w-7 h-7" strokeWidth={1.6} />
                  </span>
                  <div>
                    <p className="text-2xl font-extrabold text-[#0a2a4e] leading-none">100%</p>
                    <p className="text-xs text-slate-500 mt-1">practică pe Marea Neagră</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-28 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Waves, t: 'Practică reală pe mare', d: 'Ieși zilnic în larg la Limanu — nu rămâi blocat în sala de curs.' },
              { icon: Sailboat, t: 'Antrenament pe barcă reală', d: 'Înveți pe ambarcațiuni adevărate, în condiții autentice de navigație.' },
              { icon: Users, t: 'Grupuri mici', d: 'Atenție individuală și timp real la cârmă pentru fiecare cursant.' },
              { icon: Award, t: 'Instructori profesioniști', d: 'Skipperi cu experiență internațională care te pregătesc temeinic.' },
            ].map(({ icon: Icon, t, d }, i) => (
              <div key={t} className="reveal text-center sm:text-left" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="w-12 h-12 rounded-xl bg-[#eef4fb] text-[#0a2a4e] flex items-center justify-center mb-4 mx-auto sm:mx-0">
                  <Icon className="w-7 h-7" strokeWidth={1.6} />
                </div>
                <h4 className="font-bold text-[#0a2a4e] mb-2">{t}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== FOR WHOM ============== */}
      <section id="cui" className="py-20 bg-[#eef4fb]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-10 text-center">PENTRU CINE ESTE CURSUL?</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {[
              { icon: Users, t: 'Pasionați de mare', d: 'Vrei să-ți transformi pasiunea într-un skill real.' },
              { icon: Compass, t: 'Călători & aventurieri', d: 'Vrei să ai libertate în vacanțele tale pe apă.' },
              { icon: Ship, t: 'Familii & prieteni', d: 'Vrei experiențe speciale alături de cei dragi.' },
              { icon: GraduationCap, t: 'Viitori profesioniști', d: 'Țintești o carieră în domeniul nautic.' },
            ].map(({ icon: Icon, t, d }, i) => (
              <div key={t} className="reveal text-center" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="w-14 h-14 rounded-2xl bg-white shadow-[0_10px_40px_-12px_rgba(10,42,78,0.18)] text-[#0a2a4e] flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8" strokeWidth={1.5} />
                </div>
                <h4 className="font-bold text-[#0a2a4e] mb-1.5">{t}</h4>
                <p className="text-sm text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== COURSE DATE BLOCK / INSCRIERE ============== */}
      <section id="inscriere" className="py-24 lg:py-28 bg-[#06203c] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#2ea8d8]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#2ea8d8]/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-5 lg:px-8 relative">
          <div className="grid lg:grid-cols-3 gap-8 items-stretch">
            {/* date */}
            <div className="reveal lg:pr-4">
              <p className="tracking-[0.28em] text-[#5cc2ea] font-bold text-xs mb-5">URMĂTORUL CURS</p>
              <p className={`${display} text-white text-6xl lg:text-7xl font-bold leading-none`}>
                8 – 11<br />IUNIE
              </p>
              <p className="text-white/80 text-xl mt-5 font-medium">Luni – Joi · Limanu</p>

              <div className="mt-9 space-y-4 text-white/75 text-sm">
                <p className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> Grupuri mici pentru practică reală
                </p>
                <p className="flex items-center gap-3">
                  <Award className="w-5 h-5 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> Instructori experimentați
                </p>
                <p className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#f5b528] shrink-0" strokeWidth={1.6} />{' '}
                  <span className="text-[#f5b528] font-semibold">Locuri limitate</span>
                </p>
              </div>
            </div>

            {/* enroll card */}
            <div className="reveal bg-white rounded-2xl shadow-[0_24px_60px_-18px_rgba(10,42,78,0.35)] p-8 lg:-mt-4" style={{ transitionDelay: '0.1s' }}>
              <h3 className={`${display} text-2xl font-bold text-[#0a2a4e] mb-6`}>Curs intensiv Yachting CDS</h3>
              <ul className="space-y-4 mb-7">
                <li className="flex items-center gap-3 text-slate-700">
                  <CalendarDays className="w-5 h-5 text-[#2ea8d8] shrink-0" strokeWidth={1.7} /> 4 zile (luni – joi)
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <Sailboat className="w-5 h-5 text-[#2ea8d8] shrink-0" strokeWidth={1.7} /> Teorie + practică zilnică
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <MapPin className="w-5 h-5 text-[#2ea8d8] shrink-0" strokeWidth={1.7} /> Limanu – Marea Neagră
                </li>
              </ul>

              <div className="bg-[#eef4fb] rounded-xl p-4 mb-6 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Investiție</p>
                  <p className="text-3xl font-extrabold text-[#0a2a4e] leading-tight">
                    — lei <span className="text-sm font-medium text-slate-400">/ persoană</span>
                  </p>
                </div>
                <span className="text-xs bg-[#f5b528]/20 text-[#e0a014] font-bold px-2.5 py-1 rounded-full">Early bird</span>
              </div>

              <a
                href="#contact"
                className="block text-center bg-[#f5b528] hover:bg-[#e0a014] text-[#0a2a4e] font-bold tracking-wide py-4 rounded-xl shadow-[0_14px_34px_-8px_rgba(245,181,40,0.55)] transition hover:-translate-y-0.5"
              >
                ÎNSCRIE-TE ACUM
              </a>
              <p className="text-center text-xs text-slate-400 mt-4">
                Confirmarea locului se face în ordinea înscrierilor.
              </p>
            </div>

            {/* bonus */}
            <div className="reveal rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-8 flex flex-col" style={{ transitionDelay: '0.2s' }}>
              <span className="w-14 h-14 rounded-2xl bg-[#f5b528]/15 text-[#f5b528] flex items-center justify-center mb-6">
                <Gift className="w-8 h-8" strokeWidth={1.5} />
              </span>
              <h3 className={`${display} text-white text-2xl font-bold mb-5`}>Bonus pentru cursanți</h3>
              <ul className="space-y-4 text-white/80 text-sm">
                {['Materiale de curs incluse', 'Suport după curs', 'Reduceri la cursuri avansate'].map((b) => (
                  <li key={b} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#5cc2ea] shrink-0" strokeWidth={3} /> {b}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <p className="text-white/50 text-xs">Locurile se ocupă rapid în sezon. Rezervă din timp.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== TESTIMONIALS ============== */}
      <section id="testimoniale" className="py-24 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <p className="tracking-[0.28em] text-[#2ea8d8] font-bold text-xs mb-3 text-center">CE SPUN CURSANȚII NOȘTRI</p>
          <h2 className={`${display} text-[#0a2a4e] text-4xl lg:text-5xl font-bold text-center mb-16`}>
            Experiențe reale pe mare
          </h2>

          <div className="grid md:grid-cols-3 gap-7">
            {[
              { q: '4 zile intense, dar care mi-au schimbat complet perspectiva. Acum pot să navighez oriunde cu încredere!', n: 'Andrei M.', c: 'București', img: 'https://i.pravatar.cc/80?img=12' },
              { q: 'Instructorii sunt profesioniști, iar practica pe mare face toată diferența. Recomand cu încredere!', n: 'Ioana P.', c: 'Cluj-Napoca', img: 'https://i.pravatar.cc/80?img=45' },
              { q: 'Un curs foarte bine structurat, cu multă practică și exemple reale. Merită fiecare leu și fiecare zi!', n: 'Vlad T.', c: 'Timișoara', img: 'https://i.pravatar.cc/80?img=33' },
            ].map(({ q, n, c, img }, i) => (
              <figure
                key={n}
                className="reveal bg-[#eef4fb]/60 border border-slate-100 rounded-2xl p-8 hover:shadow-[0_24px_60px_-18px_rgba(10,42,78,0.35)] transition"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="flex gap-1 text-[#f5b528] mb-5">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="w-4 h-4 fill-current" strokeWidth={0} />
                  ))}
                </div>
                <blockquote className="text-slate-700 leading-relaxed">„{q}”</blockquote>
                <figcaption className="flex items-center gap-3 mt-6">
                  <img src={img} alt={n} className="w-11 h-11 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-[#0a2a4e] text-sm">{n}</p>
                    <p className="text-xs text-slate-500">{c}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="relative py-28 lg:py-32 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(120deg, rgba(6,32,60,0.92), rgba(10,42,78,0.78)), url('${FINAL_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-5 lg:px-8 text-center reveal">
          <p className="tracking-[0.28em] text-[#5cc2ea] font-bold text-xs mb-5">ULTIMELE LOCURI · 8–11 IUNIE</p>
          <h2 className={`${display} text-white text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight`}>
            Rezervă locul tău acum
          </h2>
          <p className="text-white/80 text-lg mt-6 max-w-2xl mx-auto">
            Începe-ți drumul către libertatea de a naviga oriunde în lume. Grupurile sunt mici și
            locurile se ocupă rapid.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-3 bg-[#f5b528] hover:bg-[#e0a014] text-[#0a2a4e] font-bold tracking-wide px-9 py-4 rounded-xl shadow-[0_14px_34px_-8px_rgba(245,181,40,0.55)] transition hover:-translate-y-0.5"
            >
              REZERVĂ LOCUL ACUM
              <ArrowRight className="w-5 h-5" strokeWidth={2.2} />
            </a>
            <a
              href="tel:+40741123456"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold px-8 py-4 rounded-xl backdrop-blur transition"
            >
              <Phone className="w-5 h-5" strokeWidth={1.8} /> +40 741 123 456
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
                <span>
                  <span className="block font-extrabold text-lg leading-none">SETSAIL</span>
                  <span className="block text-[10px] tracking-[0.3em] text-[#5cc2ea]/80">YACHTING SCHOOL</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Școala de yachting din Limanu, dedicată celor care iubesc marea și vor să navigheze în
                siguranță.
              </p>
              <div className="flex gap-3 mt-5">
                {[BrandFacebook, BrandInstagram, BrandYoutube].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-[#2ea8d8] flex items-center justify-center transition"
                    aria-label="Social"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold text-sm tracking-wide mb-5">LINKURI UTILE</h4>
              <ul className="space-y-3 text-sm">
                {navLinks.slice(0, 5).map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="hover:text-[#5cc2ea] transition capitalize">
                      {l.label.toLowerCase()}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold text-sm tracking-wide mb-5">INFORMAȚII</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> Limanu, Jud. Constanța
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> +40 741 123 456
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#5cc2ea] shrink-0" strokeWidth={1.6} /> contact@setsail.ro
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold text-sm tracking-wide mb-5">NEWSLETTER</h4>
              <p className="text-sm mb-4">Abonează-te pentru noutăți și oferte speciale.</p>
              <form className="flex" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="Emailul tău"
                  className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-l-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#2ea8d8]"
                />
                <button
                  className="bg-[#2ea8d8] hover:bg-[#5cc2ea] text-white px-4 rounded-r-lg transition"
                  aria-label="Abonează-te"
                >
                  <Send className="w-5 h-5" strokeWidth={1.8} />
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-white/50">
            <p>© 2024 SetSail Yachting School. Toate drepturile rezervate.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition">Termeni și condiții</a>
              <a href="#" className="hover:text-white transition">Politica de confidențialitate</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ============== STICKY MOBILE CTA ============== */}
      <a
        href="#inscriere"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#f5b528] text-[#0a2a4e] font-bold text-center py-4 shadow-[0_-6px_20px_rgba(0,0,0,0.15)]"
      >
        REZERVĂ LOCUL · 8–11 IUNIE →
      </a>
    </div>
  )
}
