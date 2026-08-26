// Reguli comune pentru „aceeași persoană" în tabela `students`.
// Fiecare rând e o înscriere la o sesiune, deci aceeași persoană poate avea mai
// multe rânduri — dar niciodată două în aceeași sesiune.

// Câmpurile care se moștenesc de la o fișă existentă a aceleiași persoane:
// date personale + documentele deja încărcate.
export const CARRY_FIELDS = [
  'cnp', 'birth_date', 'address', 'city', 'county', 'country', 'phone', 'email',
  'ci_series', 'ci_number', 'expiry_date', 'nationality', 'doc_type',
  'ci_image_data', 'ci_verso_data', 'adeverinta_adresa_data', 'certificat_nastere_data',
  'signature_data', 'lrc_certificat_data', 'lrc_numar', 'lrc_emis_la', 'lrc_expira_la',
]

const clean = (v: any) => String(v ?? '').trim()

// Aceeași persoană? Potrivire în ordinea încrederii: CNP → email → nume.
export function samePerson(
  a: { cnp?: any; email?: any; full_name?: any },
  b: { cnp?: any; email?: any; full_name?: any },
): boolean {
  const cnpA = clean(a.cnp), cnpB = clean(b.cnp)
  if (cnpA.length > 5 && cnpB.length > 5) return cnpA === cnpB
  const mailA = clean(a.email).toLowerCase(), mailB = clean(b.email).toLowerCase()
  if (mailA && mailB) return mailA === mailB
  const nameA = clean(a.full_name).toLowerCase(), nameB = clean(b.full_name).toLowerCase()
  return !!nameA && nameA === nameB
}

// Îmbină o fișă veche cu datele introduse acum: ce s-a scris acum are prioritate,
// restul se completează din fișa veche (inclusiv documentele).
export function mergeCarry(incoming: Record<string, any>, previous: Record<string, any>): Record<string, any> {
  const out = { ...incoming }
  for (const f of CARRY_FIELDS) {
    if (!clean(out[f]) && clean(previous?.[f])) out[f] = previous[f]
  }
  return out
}

// Doar câmpurile pe care fișa existentă NU le are și care vin acum —
// pentru completarea unei fișe deja aflate în sesiune, fără a suprascrie nimic.
export function fillGaps(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
  const upd: Record<string, any> = {}
  for (const f of CARRY_FIELDS) {
    if (!clean(existing?.[f]) && clean(incoming?.[f])) upd[f] = incoming[f]
  }
  return upd
}
