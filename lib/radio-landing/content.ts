// ============================================================================
// Radio GMDSS/LRC Landing — content model + defaults (Variant B: console/split)
// ============================================================================
export type RadioContent = typeof DEFAULT_CONTENT

export const DEFAULT_CONTENT = {
  nav: {
    brandTitle: 'SETSAIL',
    brandSubtitle: 'GMDSS · LRC',
    links: [
      { label: 'DESPRE', href: '#despre' },
      { label: 'PROGRAM', href: '#program' },
      { label: 'PREȚ', href: '#inscriere' },
      { label: 'CONTACT', href: '#contact' },
    ],
    cta: 'ÎNSCRIE-TE',
  },
  hero: {
    eyebrow: 'CURS RADIOCOMUNICAȚII MARITIME · GMDSS / LRC',
    titleLine1: 'Operează stația radio.',
    titleLine2: 'Comunică. Cere ajutor.',
    titleAccent: 'Navighează legal.',
    subtitle:
      'Certificat GMDSS / LRC — obligatoriu pentru a folosi stația de la bord și pentru charter în străinătate. 100% online, pe Zoom.',
    ctaPrimary: 'Rezervă loc · 15–17 iunie',
    ctaSecondary: 'Vezi programul',
    stats: [
      { value: '3', label: 'seri · 18–21' },
      { value: '5', label: 'ani valabil' },
      { value: '16+', label: 'fără cerințe' },
    ],
    console: {
      title: 'GMDSS · DSC CONTROLLER',
      channel: '16',
      mmsiLabel: 'MMSI',
      mmsi: '272 1234 56',
      chips: ['VHF', 'MF/HF', 'NAVTEX', 'SART'],
      distressLabel: 'DISTRESS',
    },
  },
  coverage: {
    eyebrow: 'CE ACOPERĂ CURSUL',
    title: 'Echipamente & proceduri GMDSS',
    items: [
      { title: 'VHF / MF / HF', desc: 'Radiotelefonie, canale, benzi și antene.' },
      { title: 'DSC & satelit', desc: 'Digital Selective Calling, Inmarsat.' },
      { title: 'EPIRB / SART', desc: 'Balize de pericol și transpondere SAR.' },
      { title: 'Proceduri & engleză', desc: 'Pericol / urgență / siguranță + phraseology.' },
    ],
  },
  timeline: {
    eyebrow: 'STRUCTURA CURSULUI',
    title: '3 seri intensive pe Zoom',
    days: [
      { title: 'Principii & legislație', items: ['Bazele radiocomunicațiilor', 'Benzi VHF / MF / HF', 'Reglementări și alfabet fonetic'] },
      { title: 'Echipamente & GMDSS', items: ['DSC, NAVTEX, EPIRB, SART', 'Simulare trafic GMDSS', 'Exerciții SAR + operare stație'] },
      { title: 'Engleză maritimă & examen', items: ['Phraseology standard', 'Proceduri de pericol', 'Examen de certificare'] },
    ],
  },
  benefits: {
    eyebrow: 'CE OBȚII LA FINAL',
    title: 'Vei putea să:',
    items: [
      'Operezi corect stația radio (VHF / MF / HF, DSC)',
      'Transmiți apeluri de pericol, urgență și siguranță',
      'Folosești EPIRB, SART și NAVTEX',
      'Închiriezi ambarcațiuni în străinătate, legal',
      'Obții certificatul internațional GMDSS / LRC (5 ani)',
    ],
    why: [
      { title: 'Obligatoriu pentru charter', desc: 'Fără certificat radio nu poți închiria legal un iaht în RO, Grecia, Croația sau Turcia.' },
      { title: 'Siguranță pe mare', desc: 'Apel de pericol, urgență și siguranță, proceduri SAR și operare DSC corectă.' },
      { title: '100% online', desc: '3 seri pe Zoom, de oriunde — fără deplasare.' },
      { title: 'Instructori cu experiență', desc: 'Sorin & Ovidiu Drugan, instructori SetSail.' },
    ],
  },
  forWhom: {
    eyebrow: 'PENTRU CINE ESTE CURSUL',
    cards: [
      { title: 'Skipperi & comandanți', desc: 'Vrei să operezi legal stația de la bord.' },
      { title: 'Charter în străinătate', desc: 'Ai nevoie de certificat pentru a închiria.' },
      { title: 'Absolvenți CDS', desc: 'Pasul următor după permisul de navigație.' },
      { title: 'Pasionați de mare', desc: 'Vrei competențe complete de navigație.' },
    ],
  },
  enroll: {
    eyebrow: 'URMĂTOAREA SESIUNE',
    dateBig: '15 – 17\nIUNIE',
    dateSub: 'Luni – Miercuri · 18:00–21:00 · pe Zoom',
    points: ['3 seri intensive online', 'Certificat valabil 5 ani', 'Locuri limitate'],
    cardTitle: 'Curs radio GMDSS / LRC',
    cardPoints: ['3 seri (luni–miercuri)', 'Online pe Zoom', 'Examen de certificare inclus'],
    priceGrad: '€160',
    priceGradUnit: '+TVA / absolvent SetSail',
    priceRenew: '€100',
    priceRenewUnit: '+TVA reînnoire',
    priceStd: '€200 +TVA / persoană (tarif standard)',
    ctaLabel: 'ÎNSCRIE-TE ACUM',
    ctaNote: 'Confirmarea locului se face în ordinea înscrierilor.',
    bonusTitle: 'Cursul include',
    bonusItems: ['Materiale de curs', 'Simulare trafic GMDSS', 'Suport la examen'],
  },
  testimonials: {
    eyebrow: 'CE SPUN CURSANȚII NOȘTRI',
    title: 'Pregătiți pentru larg',
    items: [
      { quote: 'Explicat clar, cu exemple reale de trafic radio. Am dat examenul fără emoții.', name: 'Mihai R.', city: 'Constanța' },
      { quote: 'Online, dar foarte practic — simularea GMDSS face diferența. Recomand!', name: 'Elena V.', city: 'București' },
      { quote: 'Aveam nevoie de certificat pentru charter în Grecia. Exact ce trebuia, în 3 seri.', name: 'Radu P.', city: 'Brașov' },
    ],
  },
  finalCta: {
    eyebrow: 'ULTIMELE LOCURI · 15–17 IUNIE',
    title: 'Rezervă locul tău acum',
    subtitle: 'Obține certificatul radio obligatoriu și pleacă în larg pregătit. Locuri limitate pentru sesiunea online.',
    ctaLabel: 'REZERVĂ LOCUL ACUM',
    phone: '+40 741 123 456',
  },
  footer: {
    brandTitle: 'SETSAIL',
    brandSubtitle: 'YACHTING SCHOOL',
    about: 'Școala de yachting din Limanu. Cursuri de navigație și radiocomunicații maritime GMDSS / LRC.',
    linksTitle: 'LINKURI UTILE',
    infoTitle: 'INFORMAȚII',
    address: 'Online · pe Zoom',
    phone: '+40 741 123 456',
    email: 'contact@setsail.ro',
    newsletterTitle: 'NEWSLETTER',
    newsletterText: 'Abonează-te pentru date noi de curs și oferte.',
    copyright: '© 2024 SetSail Yachting School. Toate drepturile rezervate.',
  },
  leadForm: {
    title: 'Rezervă-ți locul',
    subtitle: 'Completează formularul și te contactăm pentru confirmarea locului la cursul radio 15–17 iunie.',
    nameLabel: 'Nume și prenume',
    emailLabel: 'Email',
    phoneLabel: 'Telefon',
    messageLabel: 'Mesaj (opțional)',
    submitLabel: 'Trimite solicitarea',
    successTitle: 'Mulțumim!',
    successMsg: 'Am primit solicitarea ta. Te contactăm în cel mai scurt timp pentru confirmare.',
  },
}

export function mergeContent(db: any): RadioContent {
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
