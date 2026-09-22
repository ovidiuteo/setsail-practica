// Linkurile scrise fără protocol („skipper.setsail.ro") ar fi tratate de browser
// ca adrese relative la site-ul nostru; le completăm cu https://.
export function urlAbsolut(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s
  if (s.startsWith('//')) return 'https:' + s
  return 'https://' + s.replace(/^\/+/, '')
}
