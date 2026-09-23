// Aceeași persoană poate avea câte o fișă în fiecare serie la care s-a înscris.
// Recunoaștem omul după, în ordinea încrederii: CNP, email, ultimele 8 cifre ale
// telefonului (fără spații, liniuțe, puncte sau prefix de țară).

export type Persoana = { cnp?: string | null; email?: string | null; phone?: string | null }

export const cheieCnp = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length === 13 ? d : ''
}
export const cheieEmail = (v: unknown) => String(v ?? '').trim().toLowerCase()
export const cheieTelefon = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length >= 8 ? d.slice(-8) : ''
}

// Toate cheile după care fișa asta poate fi legată de altele
export function cheiPersoana(p: Persoana): string[] {
  const chei: string[] = []
  const cnp = cheieCnp(p.cnp);        if (cnp) chei.push('cnp:' + cnp)
  const email = cheieEmail(p.email);  if (email) chei.push('email:' + email)
  const tel = cheieTelefon(p.phone);  if (tel) chei.push('tel:' + tel)
  return chei
}

export const aceeasiPersoana = (a: Persoana, b: Persoana) =>
  cheiPersoana(a).some(k => cheiPersoana(b).includes(k))

// Strânge fișele care sunt ale aceleiași persoane. Legătura se transmite: dacă
// fișa A are CNP-ul lui B, iar B are telefonul lui C, toate trei sunt un om.
// Fișele fără nicio cheie rămân fiecare pe cont propriu.
export function grupeazaPersoane<T>(randuri: T[], date: (r: T) => Persoana): T[][] {
  const parinte = new Map<string, string>()
  const radacina = (k: string): string => {
    const p = parinte.get(k)
    if (!p || p === k) { parinte.set(k, k); return k }
    const r = radacina(p); parinte.set(k, r); return r
  }
  const uneste = (a: string, b: string) => { parinte.set(radacina(a), radacina(b)) }

  const cheiPerRand = randuri.map(r => cheiPersoana(date(r)))
  cheiPerRand.forEach((chei, i) => {
    const propria = 'rand:' + i
    radacina(propria)
    for (const k of chei) { radacina(k); uneste(propria, k) }
  })

  const grupe = new Map<string, T[]>()
  randuri.forEach((r, i) => {
    const cheie = radacina('rand:' + i)
    const g = grupe.get(cheie)
    if (g) g.push(r); else grupe.set(cheie, [r])
  })
  return Array.from(grupe.values())
}
