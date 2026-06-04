// ============================================================================
// CDS Landing — content model, defaults, editor schema (labels + hints)
// ============================================================================
// The whole landing page is driven by this content object, stored as JSONB in
// public.cds_landing.content. DEFAULT_CONTENT is the source of truth for shape;
// DB values are deep-merged over it, so adding new fields here is safe.
// ============================================================================

export type LandingContent = typeof DEFAULT_CONTENT

export const DEFAULT_CONTENT = {
  nav: {
    brandTitle: 'SETSAIL',
    brandSubtitle: 'YACHTING SCHOOL',
    links: [
      { label: 'DESPRE NOI', href: '#despre' },
      { label: 'CURSURI', href: '#structura' },
      { label: 'PERMIS BARCĂ', href: '#beneficii' },
      { label: 'FLOTĂ', href: '#cui' },
      { label: 'RECENZII', href: '#testimoniale' },
      { label: 'CONTACT', href: '#contact' },
    ],
    cta: 'ÎNSCRIE-TE ACUM',
  },
  hero: {
    eyebrow: 'CURS INTENSIV YACHTING',
    titleLine1: 'În 4 zile înveți să',
    titleLine2: 'conduci o barcă.',
    titleAccent: 'Oriunde în lume.',
    subtitle:
      'Curs intensiv de yachting categoria C + D + S — teorie + practică reală în fiecare zi, la Limanu, Marea Neagră.',
    benefits: [
      { title: 'Skill internațional', sub: 'utilizabil oriunde' },
      { title: '50% teorie', sub: '50% practică' },
      { title: 'Format intensiv', sub: 'Luni – Joi' },
    ],
    ctaLabel: 'REZERVĂ LOCUL PENTRU 8–11 IUNIE',
    urgency: 'Locuri limitate · grupuri mici',
    image:
      'https://images.unsplash.com/photo-1500627964684-141351970a7f?auto=format&fit=crop&w=2400&q=80',
  },
  value: {
    eyebrow: 'DE CE SĂ FII SKIPPER?',
    title: 'Un skill care îți schimbă libertatea',
    subtitle:
      'Nu înveți doar „să mergi cu barca”. Câștigi independența de a explora marea oriunde în lume — în vacanță, în charter sau într-o carieră.',
    cards: [
      {
        title: 'Vacanțe independente',
        desc: 'Navighezi cu familia sau prietenii în cele mai frumoase destinații maritime — fără skipper plătit, în ritmul tău.',
        image:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
      },
      {
        title: 'Lifestyle premium',
        desc: 'Libertate totală pe apă. Închiriezi o barcă oriunde în lume și te bucuri de mare ca un lifestyle, nu ca un eveniment rar.',
        image:
          'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=400&q=80',
      },
      {
        title: 'Carieră skipper',
        desc: 'Primul pas concret către o carieră în yachting și joburi de skipper plătite, în România și internațional.',
        image:
          'https://images.unsplash.com/photo-1565627866642-f23a05d63d68?auto=format&fit=crop&w=400&q=80',
      },
    ],
  },
  timeline: {
    eyebrow: 'STRUCTURA CURSULUI',
    title: '4 zile intensive. Fiecare zi = teorie + practică',
    days: [
      { title: 'Bazele navigației', items: ['Elemente de teorie', 'Siguranță pe apă', 'Prim contact cu barca'] },
      { title: 'Manevre în port', items: ['Control motor și vele', 'Porniri, opriri, viraje', 'Andocare și acostare'] },
      { title: 'Navigație în larg', items: ['Plecare în larg', 'Comunicații maritime', 'Situații reale pe mare'] },
      { title: 'Simulare completă', items: ['Planificare traseu', 'Exerciții complexe', 'Evaluare și pregătire examen'] },
    ],
  },
  benefits: {
    eyebrow: 'CE PRIMEȘTI LA FINAL',
    title: 'Vei putea să:',
    items: [
      'Conduci o barcă cu velă cu încredere și în siguranță',
      'Înțelegi navigația și regulile de pe mare',
      'Aplici regulile de siguranță în condiții reale',
      'Închiriezi ambarcațiuni în România și în străinătate',
      'Continui spre certificări avansate și carieră în yachting',
    ],
    image:
      'https://images.unsplash.com/photo-1502209524164-acea936639a2?auto=format&fit=crop&w=900&q=80',
    badgeValue: '100%',
    badgeLabel: 'practică pe Marea Neagră',
    why: [
      { title: 'Practică reală pe mare', desc: 'Ieși zilnic în larg la Limanu — nu rămâi blocat în sala de curs.' },
      { title: 'Antrenament pe barcă reală', desc: 'Înveți pe ambarcațiuni adevărate, în condiții autentice de navigație.' },
      { title: 'Grupuri mici', desc: 'Atenție individuală și timp real la cârmă pentru fiecare cursant.' },
      { title: 'Instructori profesioniști', desc: 'Skipperi cu experiență internațională care te pregătesc temeinic.' },
    ],
  },
  forWhom: {
    eyebrow: 'PENTRU CINE ESTE CURSUL?',
    cards: [
      { title: 'Pasionați de mare', desc: 'Vrei să-ți transformi pasiunea într-un skill real.' },
      { title: 'Călători & aventurieri', desc: 'Vrei să ai libertate în vacanțele tale pe apă.' },
      { title: 'Familii & prieteni', desc: 'Vrei experiențe speciale alături de cei dragi.' },
      { title: 'Viitori profesioniști', desc: 'Țintești o carieră în domeniul nautic.' },
    ],
  },
  enroll: {
    eyebrow: 'URMĂTORUL CURS',
    dateBig: '8 – 11\nIUNIE',
    dateSub: 'Luni – Joi · Limanu',
    points: ['Grupuri mici pentru practică reală', 'Instructori experimentați', 'Locuri limitate'],
    cardTitle: 'Curs intensiv Yachting CDS',
    cardPoints: ['4 zile (luni – joi)', 'Teorie + practică zilnică', 'Limanu – Marea Neagră'],
    priceValue: '— lei',
    priceUnit: '/ persoană',
    priceBadge: 'Early bird',
    ctaLabel: 'ÎNSCRIE-TE ACUM',
    ctaNote: 'Confirmarea locului se face în ordinea înscrierilor.',
    bonusTitle: 'Bonus pentru cursanți',
    bonusItems: ['Materiale de curs incluse', 'Suport după curs', 'Reduceri la cursuri avansate'],
  },
  testimonials: {
    eyebrow: 'CE SPUN CURSANȚII NOȘTRI',
    title: 'Experiențe reale pe mare',
    items: [
      { quote: '4 zile intense, dar care mi-au schimbat complet perspectiva. Acum pot să navighez oriunde cu încredere!', name: 'Andrei M.', city: 'București', image: 'https://i.pravatar.cc/80?img=12' },
      { quote: 'Instructorii sunt profesioniști, iar practica pe mare face toată diferența. Recomand cu încredere!', name: 'Ioana P.', city: 'Cluj-Napoca', image: 'https://i.pravatar.cc/80?img=45' },
      { quote: 'Un curs foarte bine structurat, cu multă practică și exemple reale. Merită fiecare leu și fiecare zi!', name: 'Vlad T.', city: 'Timișoara', image: 'https://i.pravatar.cc/80?img=33' },
    ],
  },
  finalCta: {
    eyebrow: 'ULTIMELE LOCURI · 8–11 IUNIE',
    title: 'Rezervă locul tău acum',
    subtitle:
      'Începe-ți drumul către libertatea de a naviga oriunde în lume. Grupurile sunt mici și locurile se ocupă rapid.',
    ctaLabel: 'REZERVĂ LOCUL ACUM',
    phone: '+40 741 123 456',
    image:
      'https://images.unsplash.com/photo-1540946485063-a40da27545f8?auto=format&fit=crop&w=2000&q=80',
  },
  footer: {
    brandTitle: 'SETSAIL',
    brandSubtitle: 'YACHTING SCHOOL',
    about: 'Școala de yachting din Limanu, dedicată celor care iubesc marea și vor să navigheze în siguranță.',
    linksTitle: 'LINKURI UTILE',
    infoTitle: 'INFORMAȚII',
    address: 'Limanu, Jud. Constanța',
    phone: '+40 741 123 456',
    email: 'contact@setsail.ro',
    newsletterTitle: 'NEWSLETTER',
    newsletterText: 'Abonează-te pentru noutăți și oferte speciale.',
    copyright: '© 2024 SetSail Yachting School. Toate drepturile rezervate.',
  },
  leadForm: {
    title: 'Rezervă-ți locul',
    subtitle: 'Completează formularul și te contactăm pentru confirmarea locului la cursul 8–11 iunie.',
    nameLabel: 'Nume și prenume',
    emailLabel: 'Email',
    phoneLabel: 'Telefon',
    messageLabel: 'Mesaj (opțional)',
    submitLabel: 'Trimite solicitarea',
    successTitle: 'Mulțumim!',
    successMsg: 'Am primit solicitarea ta. Te contactăm în cel mai scurt timp pentru confirmarea locului.',
  },
}

// ---------------------------------------------------------------------------
// Deep-merge DB content over defaults (objects deep, arrays replaced wholesale)
// ---------------------------------------------------------------------------
export function mergeContent(db: any): LandingContent {
  return deepMerge(DEFAULT_CONTENT, db || {})
}

function isPlainObject(v: any): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(base: any, over: any): any {
  if (!isPlainObject(base)) return over === undefined ? base : over
  const out: any = Array.isArray(base) ? [...base] : { ...base }
  for (const key of Object.keys(base)) {
    if (over && key in over && over[key] !== undefined && over[key] !== null) {
      out[key] = isPlainObject(base[key]) ? deepMerge(base[key], over[key]) : over[key]
    }
  }
  return out
}
