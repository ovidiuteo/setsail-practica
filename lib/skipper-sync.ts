// Sincronizarea unei sesiuni cu grupa ei de pe skipper.setsail.ro.
// Aceeași logică e folosită și din pagina de admin a sesiunii, și din pagina cu
// token — diferă doar felul în care se face autentificarea în ruta apelantă.

import { fetchSkipperTableTsv, skipperGroupId } from './skipper'
import { parseStudentsText } from './import-parse'
import { CARRY_FIELDS, findPersonRows, ceaMaiRecenta, samePerson } from './student-merge'

import type { SyncResult } from './skipper-result'
export type { SyncResult }
export type SyncError = { error: string; status: number }

// Grupele unei serii: seria principală (fără limită) și clonele ei, fiecare cu
// maximum LOCURI_GRUPA cursanți. Un cursant nou intră în prima grupă neplină;
// dacă toate sunt pline, rămâne pe seria principală, din care se pot desprinde clone.
export const LOCURI_GRUPA = 15

// Cursanții din serie care nu mai apar în tabelul de pe skipper NU se șterg în
// timpul sincronizării: îi raportăm, iar ștergerea o cere clientul după ce
// utilizatorul vede lista și are ocazia să dea undo. Așa nimic nu se pierde
// dacă tabelul de pe skipper e incomplet într-o zi.

export function esteEroare(r: SyncResult | SyncError): r is SyncError {
  return (r as SyncError).error !== undefined
}

// Citește grupa de pe skipper (linkul salvat pe sesiune + /full-table) și adaugă
// în sesiune cursanții care nu sunt deja acolo. Compararea se face pe email;
// pentru cei fără email pe skipper cădem pe CNP/nume (`samePerson`), ca a doua
// sincronizare să nu-i adauge din nou.
export async function syncSkipper(
  sb: any,
  sessionId: string,
  opts: { dryRun?: boolean } = {},
): Promise<SyncResult | SyncError> {
  const { data: sess } = await sb.from('sessions')
    .select('id, skipper_url, class_caa, parent_session_id').eq('id', sessionId).maybeSingle()
  if (!sess) return { error: 'sesiune inexistentă', status: 404 }
  if (!String(sess.skipper_url || '').trim())
    return { error: 'Sesiunea nu are „Link skipper" completat.', status: 400 }

  let tsv: string
  try {
    tsv = await fetchSkipperTableTsv(sess.skipper_url as string)
  } catch (e: any) {
    return { error: e.message || 'Nu am putut citi grupa de pe skipper.', status: 502 }
  }

  // Aceeași cale ca la importul de cursanți — tabelul are exact coloanele știute
  const deSkipper = parseStudentsText(tsv, (sess.class_caa as string) || 'C,D')
  if (!deSkipper.length)
    return { error: 'Nu am găsit niciun cursant în tabelul de pe skipper.', status: 422 }

  // Toate grupele seriei: principala prima, apoi clonele în ordinea creării
  const principalId = (sess as any).parent_session_id || sess.id
  const { data: clone } = await sb.from('sessions').select('id, created_at')
    .eq('parent_session_id', principalId).eq('session_type', 'clone').order('created_at')
  const idGrupe: string[] = [principalId, ...((clone || []) as any[]).map(c => c.id)]

  const { data: existenti } = await sb.from('students')
    .select('id, full_name, email, cnp, session_id, order_in_session, only_sailing')
    .in('session_id', idGrupe)
  const inSerie = existenti || []
  // câte locuri sunt ocupate în fiecare grupă și ultimul număr de ordine
  const ocupate = new Map<string, number>(idGrupe.map(id => [id, 0]))
  const ultimulOrder = new Map<string, number>(idGrupe.map(id => [id, 0]))
  for (const e of inSerie as any[]) {
    if (!e.only_sailing) ocupate.set(e.session_id, (ocupate.get(e.session_id) || 0) + 1)
    ultimulOrder.set(e.session_id, Math.max(ultimulOrder.get(e.session_id) || 0, e.order_in_session || 0))
  }
  // prima grupă cu locuri libere; dacă toate sunt pline, seria principală
  const grupaLibera = () => idGrupe.find(id => (ocupate.get(id) || 0) < LOCURI_GRUPA) || principalId

  const adaugati: string[] = []
  const existau: string[] = []
  const preluati: string[] = []   // aveau deja fișă în sistem, din altă serie

  for (const s of deSkipper) {
    // căutăm persoana în toată seria, nu doar în grupa sincronizată
    if (inSerie.some((e: any) => samePerson(e, s))) { existau.push(s.full_name); continue }

    const grupa = grupaLibera()
    const base: any = {
      session_id: grupa,
      full_name: s.full_name,
      cnp: s.cnp, birth_date: s.birth_date,
      address: s.address, city: s.city, county: s.county,
      email: s.email, phone: s.phone,
      ci_series: s.ci_series, ci_number: s.ci_number,
      class_caa: s.class_caa,
      order_in_session: (ultimulOrder.set(grupa, (ultimulOrder.get(grupa) || 0) + 1), ultimulOrder.get(grupa)),
      only_sailing: false,
      portal_status: 'pending',
    }
    // Dacă persoana e deja în sistem (altă serie), îi preluăm datele și documentele
    const prev = ceaMaiRecenta(await findPersonRows(sb, s))
    if (prev) {
      for (const f of CARRY_FIELDS) {
        if (!String(base[f] ?? '').trim() && String(prev[f] ?? '').trim()) base[f] = prev[f]
      }
      preluati.push(s.full_name)
    }
    if (!opts.dryRun) {
      const { error } = await sb.from('students').insert(base)
      if (error) return { error: `${s.full_name}: ${error.message}`, status: 500 }
    }
    ocupate.set(grupa, (ocupate.get(grupa) || 0) + 1)
    // în rezultat spunem și în ce grupă a intrat, când seria are clone
    const nrGrupa = idGrupe.indexOf(grupa) + 1
    adaugati.push(idGrupe.length > 1 ? `${s.full_name} (Grupa ${nrGrupa})` : s.full_name)
  }

  // Cine e în serie dar nu mai apare pe skipper. Cei mutați la „doar navigație"
  // sunt lăsați în pace — nu sunt participanți obișnuiți la serie.
  const deSters = inSerie
    .filter((e: any) => !e.only_sailing && !deSkipper.some(s => samePerson(e, s)))
    .map((e: any) => ({ id: e.id, full_name: e.full_name }))

  return {
    ok: true,
    dry_run: !!opts.dryRun,
    grupa: skipperGroupId(sess.skipper_url as string),
    total_skipper: deSkipper.length,
    adaugati, existau, preluati,
    de_sters: deSters,
  }
}
