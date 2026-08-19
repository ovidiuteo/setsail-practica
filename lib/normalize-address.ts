// Normalizare date de adresă pentru cursanți:
//  - county: județele devin "jud. X", sectoarele devin "Sector N", Bucureștiul rămâne "București"
//  - address: se elimină segmentele care dublează orașul / județul / sectorul
//    (adresa trebuie să conțină doar strada, numărul, blocul etc.)

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function norm(s: string): string {
  return stripDiacritics(s).toLowerCase().trim()
}

// Title-case pentru nume de județe: "satu mare" → "Satu Mare", "bistrita-nasaud" → "Bistrita-Nasaud"
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/([\s-]+)/)
    .map(part => /[\s-]/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

// Coduri auto → nume județ (pentru câmpuri completate cu "MM", "CT" etc.)
const COUNTY_CODES: Record<string, string> = {
  AB: 'Alba', AG: 'Argeș', AR: 'Arad', BC: 'Bacău', BH: 'Bihor', BN: 'Bistrița-Năsăud',
  BR: 'Brăila', BT: 'Botoșani', BV: 'Brașov', BZ: 'Buzău', CJ: 'Cluj', CL: 'Călărași',
  CS: 'Caraș-Severin', CT: 'Constanța', CV: 'Covasna', DB: 'Dâmbovița', DJ: 'Dolj',
  GJ: 'Gorj', GL: 'Galați', GR: 'Giurgiu', HD: 'Hunedoara', HR: 'Harghita', IF: 'Ilfov',
  IL: 'Ialomița', IS: 'Iași', MH: 'Mehedinți', MM: 'Maramureș', MS: 'Mureș', NT: 'Neamț',
  OT: 'Olt', PH: 'Prahova', SB: 'Sibiu', SJ: 'Sălaj', SM: 'Satu Mare', SV: 'Suceava',
  TL: 'Tulcea', TM: 'Timiș', TR: 'Teleorman', VL: 'Vâlcea', VN: 'Vrancea', VS: 'Vaslui',
}

// Localități scrise frecvent fără diacritice — cheia e forma „curățată" (litere mici,
// fără diacritice). Acoperă reședințele de județ; restul se rezolvă prin title-case.
const CITY_FIX: Record<string, string> = {
  bucuresti: 'București', constanta: 'Constanța', iasi: 'Iași', timisoara: 'Timișoara',
  brasov: 'Brașov', 'cluj-napoca': 'Cluj-Napoca', ploiesti: 'Ploiești', galati: 'Galați',
  craiova: 'Craiova', braila: 'Brăila', focsani: 'Focșani', targoviste: 'Târgoviște',
  bacau: 'Bacău', pitesti: 'Pitești', sibiu: 'Sibiu', oradea: 'Oradea', arad: 'Arad',
  baia_mare: 'Baia Mare', 'baia mare': 'Baia Mare', botosani: 'Botoșani', buzau: 'Buzău',
  calarasi: 'Călărași', 'drobeta-turnu severin': 'Drobeta-Turnu Severin',
  'targu jiu': 'Târgu Jiu', 'targu mures': 'Târgu Mureș', 'piatra neamt': 'Piatra Neamț',
  resita: 'Reșița', 'ramnicu valcea': 'Râmnicu Vâlcea', satu_mare: 'Satu Mare',
  'satu mare': 'Satu Mare', slatina: 'Slatina', slobozia: 'Slobozia', suceava: 'Suceava',
  tulcea: 'Tulcea', vaslui: 'Vaslui', zalau: 'Zalău', deva: 'Deva', alba_iulia: 'Alba Iulia',
  'alba iulia': 'Alba Iulia', 'sfantu gheorghe': 'Sfântu Gheorghe', 'miercurea ciuc': 'Miercurea Ciuc',
  'bistrita': 'Bistrița', 'alexandria': 'Alexandria', 'giurgiu': 'Giurgiu',
}

// Normalizează localitatea: scoate prefixele (mun./oraș/com.), pune majuscule
// și repune diacriticele pentru localitățile scrise fără ele („bucuresti" → „București").
export function normalizeCity(city: string | null | undefined): string {
  const c = (city || '').replace(/\s+/g, ' ').trim()
  if (!c) return ''
  const bare = c.replace(/^(?:mun|municipiul|oras(?:ul)?|orașul|loc|localitatea|com|comuna|sat(?:ul)?)\.?\s+/i, '').trim()
  if (!bare) return ''
  const fix = CITY_FIX[norm(bare)]
  return fix || titleCase(bare)
}

// Normalizează câmpul județ.
// Acceptă variante: "Constanta", "jud Constanta", "jud. Constanța", "judet Constanta",
// "județul Constanța", "MM" (cod auto), "S2", "s 2", "sec 2", "sector 2", "5", "Bucuresti".
export function normalizeCounty(county: string | null | undefined): string {
  const c = (county || '').replace(/\s+/g, ' ').trim()
  if (!c) return ''

  // Sector (cu sau fără prefix; o cifră singură 1-6 = sector)
  const sec = /^(?:(?:s|sec|sect|sector)\.?\s*)?([1-6])$/i.exec(c)
  if (sec) return `Sector ${sec[1]}`

  // București nu e județ — rămâne simplu (inclusiv codul auto "B")
  if (/^(?:mun\.?\s*|municipiul\s+)?bucuresti$/i.test(norm(c)) || c.toUpperCase() === 'B') return 'București'

  // Cod auto de județ ("MM" → Maramureș)
  const code = COUNTY_CODES[c.toUpperCase()]
  if (code) return `jud. ${code}`

  // Scoate prefixul existent (jud / jud. / judet / județul) și re-aplică forma standard
  const m = /^(?:jud|jude[tț](?:ul)?)\.?\s+(.+)$/i.exec(c)
  const name = (m ? m[1] : c).trim()
  if (!name) return ''
  return `jud. ${titleCase(name)}`
}

// Curăță adresa de segmentele care dublează orașul / județul / sectorul.
// Compară segmentele despărțite de virgulă, fără diacritice, ignorând
// prefixele uzuale (mun., oraș, loc., com., sat, jud., județul, sector).
export function cleanAddress(
  address: string | null | undefined,
  city: string | null | undefined,
  county: string | null | undefined,
): string {
  const a = (address || '').replace(/\s+/g, ' ').trim()
  if (!a) return ''

  const cityName = norm((city || '').trim())
  const countyRaw = (county || '').trim()
  // numele județului, fără prefix
  const countyName = norm(countyRaw.replace(/^(?:jud|jude[tț](?:ul)?)\.?\s+/i, ''))
  const secMatch = /^(?:s|sec|sect|sector)\.?\s*([1-6])$/i.exec(countyRaw)
  const sectorNo = secMatch ? secMatch[1] : null

  const PREFIX = /^(?:mun|municipiul|oras(?:ul)?|loc|localitatea|com|comuna|sat(?:ul)?|jud|jude[tț](?:ul)?)\.?\s+/i

  function isDuplicate(segment: string): boolean {
    let s = norm(segment)
    if (!s) return true // segment gol (virgule duble)
    // scoate prefixul (mun. / jud. / com. etc.)
    s = norm(segment.replace(PREFIX, ''))
    if (cityName && s === cityName) return true
    if (countyName && s === countyName) return true
    if (s === 'bucuresti' && (cityName === 'bucuresti' || countyName === 'bucuresti' || sectorNo)) return true
    // "sector N" / "sec N" / "s N" — doar dacă e sectorul din county (sau orice sector când orașul e București)
    const segSec = /^(?:s|sec|sect|sector)\.?\s*([1-6])$/i.exec(segment.trim())
    if (segSec && (sectorNo === segSec[1] || cityName === 'bucuresti')) return true
    return false
  }

  const kept = a.split(',').map(p => p.trim()).filter(p => !isDuplicate(p))
  const result = kept.join(', ').replace(/\s+,/g, ',').trim()
  // Siguranță: dacă tot conținutul adresei era oraș/județ, NU o golim — rămâne cum era
  return result || a
}

export type AddressChange = {
  id: string
  full_name: string
  address_before: string
  address_after: string
  city_before: string
  city_after: string
  county_before: string
  county_after: string
}

// Calculează modificările de normalizare pentru o listă de cursanți (fără a le aplica).
export function computeAddressChanges(
  students: { id: string; full_name: string; address?: string | null; city?: string | null; county?: string | null }[],
): AddressChange[] {
  const changes: AddressChange[] = []
  for (const s of students) {
    const countyAfter = normalizeCounty(s.county)
    const cityAfter = normalizeCity(s.city)
    const addressAfter = cleanAddress(s.address, s.city, s.county)
    const countyBefore = (s.county || '').trim()
    const cityBefore = (s.city || '').trim()
    const addressBefore = (s.address || '').trim()
    if (countyAfter !== countyBefore || cityAfter !== cityBefore || addressAfter !== addressBefore) {
      changes.push({
        id: s.id,
        full_name: s.full_name,
        address_before: addressBefore,
        address_after: addressAfter,
        city_before: cityBefore,
        city_after: cityAfter,
        county_before: countyBefore,
        county_after: countyAfter,
      })
    }
  }
  return changes
}
