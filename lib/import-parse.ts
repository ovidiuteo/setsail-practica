// Parser comun pentru listele de cursanți lipite din Excel/Sheets/Word.
// Folosit atât la importul din admin, cât și la portalul de verificare (pagina cu token).
// Coloanele se mapează DUPĂ NUMELE din header — nu după poziție —, ca listele
// fără coloana „Nr" să nu decaleze adresa/localitatea/județul.

export type ParsedStudent = {
  full_name: string
  cnp: string
  email: string
  phone: string
  birth_date: string
  ci_series: string
  ci_number: string
  address: string
  city: string
  county: string
  class_caa: string
}

export const EMPTY_STUDENT: ParsedStudent = {
  full_name: '', cnp: '', email: '', phone: '',
  birth_date: '', ci_series: '', ci_number: '',
  address: '', city: '', county: '', class_caa: 'C,D',
}

export function invertName(name: string): string {
  // Numele vine deja în format „Nume Prenume" din listele oficiale — doar uppercase
  return name.trim().toUpperCase()
}
export function cleanCounty(val: string): string {
  return val.trim().replace(/^jud\.\s*/i, '').replace(/^judet\s*/i, '').replace(/^județul\s*/i, '').trim()
}
export function cleanPhone(val: string): string {
  return val.replace(/^[^0-9+]/, '').trim()
}

// Județe cunoscute — pentru detectarea inversării localitate/județ
const JUDETE = ['ilfov', 'prahova', 'constanta', 'constanța', 'brasov', 'brașov', 'covasna',
  'tulcea', 'iasi', 'iași', 'cluj', 'timis', 'timiș', 'arges', 'argeș', 'dambovita', 'dâmbovița',
  'giurgiu', 'calarasi', 'călărași', 'ialomita', 'ialomița', 'buzau', 'buzău', 'vrancea',
  'galati', 'galați', 'braila', 'brăila', 'suceava', 'neamt', 'neamț', 'bacau', 'bacău',
  'vaslui', 'botosani', 'botoșani', 'dorohoi', 'alba', 'hunedoara', 'caras', 'caraș', 'bihor',
  'satu mare', 'salaj', 'sălaj', 'bistrita', 'bistrița', 'mures', 'mureș', 'harghita',
  'maramures', 'maramureș', 'sibiu', 'valcea', 'vâlcea', 'olt', 'gorj', 'dolj', 'mehedinti',
  'mehedinți', 'teleorman']

export function isJudet(val: string): boolean {
  const v = val.toLowerCase().replace(/^jud\.\s*/, '').replace(/^judet\s*/, '').trim()
  return JUDETE.includes(v) || v.startsWith('sector') || /^sector\s*\d/.test(v)
}

// Recunoaște un rând de header și mapează coloanele după nume.
export function detectHeader(parts: string[]): Record<string, number> | null {
  const map: Record<string, number> = {}
  parts.forEach((p, i) => {
    const v = p.toLowerCase().trim().replace(/\.$/, '')
    if (!v) return
    if (/^nr$/.test(v)) map.nr = i
    else if (/cursant|nume/.test(v)) map.full_name ??= i
    else if (/^cnp/.test(v)) map.cnp ??= i
    else if (/na[sșş]ter/.test(v)) map.birth_date ??= i
    else if (/e-?mail/.test(v)) map.email ??= i
    else if (/telefon|^tel$|mobil/.test(v)) map.phone ??= i
    else if (/adres/.test(v)) map.address ??= i
    else if (/localitate|ora[sșş]|city/.test(v)) map.city ??= i
    else if (/sector|jude[tțţ]/.test(v)) map.county ??= i
    else if (/^ci$|serie/.test(v)) map.ci ??= i
  })
  // e header doar dacă am recunoscut numele + încă cel puțin 2 coloane
  return (map.full_name !== undefined && Object.keys(map).length >= 3) ? map : null
}

export function parseStudentsText(text: string, defaultClass = 'C,D'): ParsedStudent[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const parsed: ParsedStudent[] = []

  // Caută rândul de header în primele linii și mapează coloanele după nume
  let startIdx = 0
  let colMap: Record<string, number> | null = null
  for (let hi = 0; hi < Math.min(5, lines.length); hi++) {
    const m = detectHeader(lines[hi].split('\t'))
    if (m) { colMap = m; startIdx = hi + 1; break }
  }

  // Unele exporturi au în header coloana „Nr" dar rândurile de date nu o conțin
  // (sau invers) -> toate câmpurile ar aluneca. Alegem deplasarea la care
  // coloana de nume chiar conține nume.
  if (colMap && colMap.full_name !== undefined) {
    const looksLikeName = (v: string) => !!v && !/^\d+$/.test(v) && /[a-zA-ZăâîșțĂÂÎȘȚ]{2,}/.test(v)
    const sample = lines.slice(startIdx, startIdx + 8)
      .map(l => l.split('\t').map(p => p.trim()))
      .filter(r => r.some(c => c))
    if (sample.length) {
      const score = (sh: number) => sample.filter(r => looksLikeName(r[colMap!.full_name + sh] || '')).length
      let best = 0
      for (const sh of [-1, 1]) if (score(sh) > score(best)) best = sh
      if (best !== 0) {
        for (const k of Object.keys(colMap)) colMap[k] += best
        for (const k of Object.keys(colMap)) if (colMap[k] < 0) delete colMap[k]
      }
    }
  }

  // Fără header recunoscut: detecție simplă de titlu (formate vechi)
  if (!colMap) {
    for (let hi = 0; hi < Math.min(3, lines.length); hi++) {
      const hparts = lines[hi].split('\t').map(p => p.trim())
      const h = lines[hi].toLowerCase()
      if (h.includes('cursant') || (hparts[0].toLowerCase() === 'nr')) startIdx = hi + 1
    }
  }

  for (let li = startIdx; li < lines.length; li++) {
    const line = lines[li]
    const parts = line.includes('\t') ? line.split('\t') : line.split(',')
    const trimmed = parts.map(p => p.trim())
    const firstIsNumber = /^\d+$/.test(trimmed[0])
    const hasCNPLabel = trimmed.some(p => p.startsWith('CNP:'))
    const firstIsEmpty = trimmed[0] === ''

    // Cu header recunoscut citim câmpurile după poziția din header
    if (colMap) {
      const at = (k: string) => (colMap![k] !== undefined ? (trimmed[colMap![k]] || '') : '')
      const cursant = at('full_name')
      if (!cursant) continue
      let localitate = at('city')
      let sectorJudet = at('county')
      if (localitate && sectorJudet) {
        if (isJudet(localitate) && !isJudet(sectorJudet)) {
          ;[localitate, sectorJudet] = [sectorJudet, localitate]
        }
      } else if (localitate && !sectorJudet && isJudet(localitate)) {
        sectorJudet = localitate; localitate = ''
      }
      const ci = at('ci').trim()
      const ciM = /^([A-Za-zĂÂÎȘȚăâîșț]{1,3})\s*([0-9]{5,9})$/.exec(ci)
      parsed.push({
        ...EMPTY_STUDENT,
        full_name: invertName(cursant),
        cnp: at('cnp').replace(/\.0$/, ''),
        birth_date: at('birth_date'),
        email: at('email'),
        phone: cleanPhone(at('phone')),
        address: at('address'),
        city: localitate,
        county: cleanCounty(sectorJudet),
        ci_series: ciM ? ciM[1].toUpperCase() : '',
        ci_number: ciM ? ciM[2] : '',
        class_caa: defaultClass,
      })
      continue
    }

    if ((firstIsNumber || firstIsEmpty) && trimmed[1] && trimmed[1] !== '') {
      // [Nr/gol] | Cursant | CNP | DataNașterii | Email | Telefon | Adresă | Localitate | Sector/Județ | CI
      let localitate = trimmed[7] || ''
      let sectorJudet = trimmed[8] || ''
      if (localitate && sectorJudet) {
        if (isJudet(localitate) && !isJudet(sectorJudet)) {
          ;[localitate, sectorJudet] = [sectorJudet, localitate]
        }
      } else if (localitate && !sectorJudet && isJudet(localitate)) {
        sectorJudet = localitate; localitate = ''
      }
      parsed.push({
        ...EMPTY_STUDENT,
        full_name: invertName(trimmed[1]),
        cnp: (trimmed[2] || '').replace(/\.0$/, ''),
        birth_date: trimmed[3] || '',
        email: trimmed[4] || '',
        phone: cleanPhone(trimmed[5] || ''),
        address: trimmed[6] || '',
        city: localitate,
        county: cleanCounty(sectorJudet),
        class_caa: defaultClass,
      })
    } else if (hasCNPLabel) {
      const full_name = trimmed[0] || ''
      const email = trimmed[1] || ''
      const phone = cleanPhone(trimmed[2] || '')
      let birth_date = '', cnp = ''
      for (const part of trimmed) {
        if (part.startsWith('CNP:')) cnp = part.replace('CNP:', '').trim()
        else if (/^\d{2}\.\d{2}\.\d{4}$/.test(part)) birth_date = part
      }
      if (!full_name) continue
      parsed.push({ ...EMPTY_STUDENT, full_name: full_name.toUpperCase(), email, phone, birth_date, cnp, city: '', class_caa: defaultClass })
    } else {
      const full_name = trimmed[0] || ''
      if (!full_name || full_name.toLowerCase() === 'nr') continue
      parsed.push({
        ...EMPTY_STUDENT, full_name: full_name.toUpperCase(), cnp: trimmed[1] || '',
        email: trimmed[2] || '', ci_series: trimmed[3] || '', city: '', class_caa: trimmed[4] || defaultClass,
      })
    }
  }
  return parsed
}
