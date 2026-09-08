// Citirea listei de cursanți dintr-o grupă skipper.setsail.ro.
//
// skipper e o aplicație Laravel separată, cu login pe sesiune — nu are API
// public. Ne autentificăm cu un cont de serviciu (SKIPPER_EMAIL / SKIPPER_PASSWORD
// din env) și citim pagina „Tabel complet" a grupei, care e HTML server-rendered.
//
// Tabelul are exact coloanele pe care le știe deja parserul de import:
//   Nr | Cursant | CNP | Data nașterii | Email | Telefon | Adresă | Localitate | Sector/Județ | CI
// așa că îl transformăm în TSV și îl dăm mai departe la `parseStudentsText`.

// https://skipper.setsail.ro/admin/groups/224 -> "224"
export function skipperGroupId(url?: string): string {
  const m = String(url || '').match(/\/groups\/(\d+)/)
  return m ? m[1] : ''
}

// Linkul salvat pe sesiune -> pagina cu tabelul complet
export function skipperFullTableUrl(url: string): string {
  const base = String(url || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  return /\/full-table$/.test(base) ? base : `${base}/full-table`
}

// ─── cookie jar minimal ────────────────────────────────────────────────────
type Jar = Record<string, string>
function absoarbe(jar: Jar, res: Response) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';')
    const i = pair.indexOf('=')
    if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim()
  }
}
const cookieHeader = (jar: Jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')

const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))

const textCelula = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

// Autentificare: luăm _token + cookies de pe /login, apoi trimitem formularul
async function login(origin: string): Promise<Jar> {
  const email = process.env.SKIPPER_EMAIL
  const password = process.env.SKIPPER_PASSWORD
  if (!email || !password) {
    throw new Error('Lipsesc SKIPPER_EMAIL / SKIPPER_PASSWORD din variabilele de mediu.')
  }

  const jar: Jar = {}
  const getRes = await fetch(`${origin}/login`, { cache: 'no-store' })
  absoarbe(jar, getRes)
  const html = await getRes.text()
  const token = /name="_token"\s+value="([^"]+)"/.exec(html)?.[1]
  if (!token) throw new Error('Nu am găsit tokenul de pe pagina de login skipper.')

  const body = new URLSearchParams({ _token: token, email, password })
  const postRes = await fetch(`${origin}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader(jar),
      'Referer': `${origin}/login`,
    },
    body,
    redirect: 'manual',
    cache: 'no-store',
  })
  absoarbe(jar, postRes)

  // Laravel răspunde cu 302 la reușită; 200 înseamnă că s-a re-randat formularul
  const location = postRes.headers.get('location') || ''
  if (postRes.status !== 302 || /\/login/.test(location)) {
    throw new Error('Autentificarea pe skipper a eșuat (verifică SKIPPER_EMAIL / SKIPPER_PASSWORD).')
  }
  return jar
}

// Tabelul grupei, ca TSV (prima linie = headerul)
export async function fetchSkipperTableTsv(groupUrl: string): Promise<string> {
  const full = skipperFullTableUrl(groupUrl)
  if (!full) throw new Error('Sesiunea nu are link skipper completat.')
  let origin: string
  try { origin = new URL(full).origin } catch { throw new Error('Linkul skipper nu e o adresă validă.') }

  const jar = await login(origin)
  const res = await fetch(full, {
    headers: { 'Cookie': cookieHeader(jar), 'Referer': origin },
    redirect: 'manual',
    cache: 'no-store',
  })
  if (res.status === 302) throw new Error('skipper ne-a trimis înapoi la login — sesiunea nu a fost acceptată.')
  if (!res.ok) throw new Error(`skipper a răspuns cu ${res.status} la pagina grupei.`)
  return parseSkipperTableHtml(await res.text())
}

// HTML-ul paginii „Tabel complet" -> TSV (prima linie = headerul). Separat de
// partea de rețea, ca să poată fi verificat pe un fișier salvat.
export function parseSkipperTableHtml(html: string): string {
  // matchAll în array, fără spread (target-ul proiectului nu iterează iteratorii)
  const toate = (re: RegExp, s: string): string[] => {
    const out: string[] = []
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    while ((m = r.exec(s))) out.push(m[1])
    return out
  }

  const heads = toate(/<th[^>]*>([\s\S]*?)<\/th>/gi, html).map(textCelula)
  if (!heads.length) throw new Error('Nu am găsit tabelul în pagina skipper (poate s-a schimbat structura).')

  const tbody = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(html)?.[1] || ''
  const linii = toate(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, tbody)
    .map(tr => toate(/<td[^>]*>([\s\S]*?)<\/td>/gi, tr).map(textCelula))
    .filter(cells => cells.some(c => c))

  return [heads, ...linii].map(r => r.join('\t')).join('\n')
}
