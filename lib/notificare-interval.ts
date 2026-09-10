// Perioada cursului, așa cum se scrie în înștiințarea ANR.
//
// Regulile:
//  - luna de la început apare doar dacă e alta decât cea de la final
//    („21 septembrie - 12 octombrie", nu „21 - 12 octombrie");
//  - anul apare doar dacă cele două date sunt din ani diferiți sau dintr-un an
//    diferit de al notificării; dacă e același an cu al notificării, se
//    subînțelege și nu-l scriem.

// 'YYYY-MM-DD' -> Date la miezul nopții LOCAL (miezul nopții UTC ar putea
// aluneca într-o altă zi, în funcție de fus)
export function ziLocala(d: string | Date): Date {
  if (d instanceof Date) return d
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number)
  return y && m && dd ? new Date(y, m - 1, dd) : new Date(d)
}

const lunaRo = (d: Date) => d.toLocaleDateString('ro-RO', { month: 'long' })

export function intervalCurs(
  start: string | Date | null | undefined,
  final: string | Date,
  dataNotificarii: string | Date,
): string {
  const fin = ziLocala(final)
  const anNotif = ziLocala(dataNotificarii).getFullYear()
  const anFin = fin.getFullYear()
  const textFin = `${fin.getDate()} ${lunaRo(fin)}`

  if (!start) return anFin !== anNotif ? `${textFin} ${anFin}` : textFin

  const inc = ziLocala(start)
  const aniDiferiti = inc.getFullYear() !== anFin
  const arataAnul = aniDiferiti || anFin !== anNotif
  const luniDiferite = inc.getMonth() !== fin.getMonth()

  const textInc = [
    String(inc.getDate()),
    (luniDiferite || aniDiferiti) ? lunaRo(inc) : '',
    aniDiferiti ? String(inc.getFullYear()) : '',
  ].filter(Boolean).join(' ')

  return `${textInc} - ${textFin}${arataAnul ? ' ' + anFin : ''}`
}
