// Verificare one-off: câte adrese de cursanți ar fi modificate de „Normalizare adrese".
// Rulare: node scripts/check-adrese.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// .env.local (dotenv nu e instalat; parsăm minimal)
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// — aceeași logică precum lib/normalize-address.ts —
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = s => strip(s).toLowerCase().trim()
const titleCase = s => s.toLowerCase().split(/([\s-]+)/).map(p => /[\s-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('')

const COUNTY_CODES = {
  AB: 'Alba', AG: 'Argeș', AR: 'Arad', BC: 'Bacău', BH: 'Bihor', BN: 'Bistrița-Năsăud',
  BR: 'Brăila', BT: 'Botoșani', BV: 'Brașov', BZ: 'Buzău', CJ: 'Cluj', CL: 'Călărași',
  CS: 'Caraș-Severin', CT: 'Constanța', CV: 'Covasna', DB: 'Dâmbovița', DJ: 'Dolj',
  GJ: 'Gorj', GL: 'Galați', GR: 'Giurgiu', HD: 'Hunedoara', HR: 'Harghita', IF: 'Ilfov',
  IL: 'Ialomița', IS: 'Iași', MH: 'Mehedinți', MM: 'Maramureș', MS: 'Mureș', NT: 'Neamț',
  OT: 'Olt', PH: 'Prahova', SB: 'Sibiu', SJ: 'Sălaj', SM: 'Satu Mare', SV: 'Suceava',
  TL: 'Tulcea', TM: 'Timiș', TR: 'Teleorman', VL: 'Vâlcea', VN: 'Vrancea', VS: 'Vaslui',
}

function normalizeCounty(county) {
  const c = (county || '').replace(/\s+/g, ' ').trim()
  if (!c) return ''
  const sec = /^(?:(?:s|sec|sect|sector)\.?\s*)?([1-6])$/i.exec(c)
  if (sec) return `Sector ${sec[1]}`
  if (/^(?:mun\.?\s*|municipiul\s+)?bucuresti$/i.test(norm(c)) || c.toUpperCase() === 'B') return 'București'
  const code = COUNTY_CODES[c.toUpperCase()]
  if (code) return `jud. ${code}`
  const m = /^(?:jud|jude[tț](?:ul)?)\.?\s+(.+)$/i.exec(c)
  const name = (m ? m[1] : c).trim()
  return name ? `jud. ${titleCase(name)}` : ''
}

function cleanAddress(address, city, county) {
  const a = (address || '').replace(/\s+/g, ' ').trim()
  if (!a) return ''
  const cityName = norm((city || '').trim())
  const countyRaw = (county || '').trim()
  const countyName = norm(countyRaw.replace(/^(?:jud|jude[tț](?:ul)?)\.?\s+/i, ''))
  const secMatch = /^(?:s|sec|sect|sector)\.?\s*([1-6])$/i.exec(countyRaw)
  const sectorNo = secMatch ? secMatch[1] : null
  const PREFIX = /^(?:mun|municipiul|oras(?:ul)?|loc|localitatea|com|comuna|sat(?:ul)?|jud|jude[tț](?:ul)?)\.?\s+/i
  const isDup = segment => {
    let s = norm(segment)
    if (!s) return true
    s = norm(segment.replace(PREFIX, ''))
    if (cityName && s === cityName) return true
    if (countyName && s === countyName) return true
    if (s === 'bucuresti' && (cityName === 'bucuresti' || countyName === 'bucuresti' || sectorNo)) return true
    const segSec = /^(?:s|sec|sect|sector)\.?\s*([1-6])$/i.exec(segment.trim())
    if (segSec && (sectorNo === segSec[1] || cityName === 'bucuresti')) return true
    return false
  }
  const result = a.split(',').map(p => p.trim()).filter(p => !isDup(p)).join(', ').replace(/\s+,/g, ',').trim()
  return result || a
}

const { data: students, error } = await supabase
  .from('students')
  .select('id, full_name, address, city, county, session_id, sessions:session_id(session_date, session_type, locations(name))')
  .order('full_name')
if (error) { console.error(error); process.exit(1) }

let addrChanges = 0, countyChanges = 0
const bySession = {}
for (const s of students) {
  const ca = cleanAddress(s.address, s.city, s.county)
  const cc = normalizeCounty(s.county)
  const aDiff = ca !== (s.address || '').trim()
  const cDiff = cc !== (s.county || '').trim()
  if (!aDiff && !cDiff) continue
  if (aDiff) addrChanges++
  if (cDiff) countyChanges++
  const sess = s.sessions
  const key = sess ? `${sess.session_date} · ${sess.locations?.name || '?'}${sess.session_type && sess.session_type !== 'principal' ? ' (' + sess.session_type + ')' : ''}` : '(fără sesiune)'
  bySession[key] = bySession[key] || []
  bySession[key].push({
    name: s.full_name,
    ...(aDiff ? { adresa: `"${s.address || ''}" → "${ca}"` } : {}),
    ...(cDiff ? { judet: `"${s.county || ''}" → "${cc}"` } : {}),
  })
}

const total = Object.values(bySession).reduce((a, l) => a + l.length, 0)
console.log(`Total cursanți: ${students.length}`)
console.log(`Cu probleme: ${total} (adresă: ${addrChanges}, județ: ${countyChanges})`)
console.log('')
for (const [sess, list] of Object.entries(bySession).sort()) {
  console.log(`── ${sess} — ${list.length} cursanți`)
  for (const it of list) {
    console.log(`   • ${it.name}`)
    if (it.adresa) console.log(`       adresă: ${it.adresa}`)
    if (it.judet) console.log(`       județ:  ${it.judet}`)
  }
}
