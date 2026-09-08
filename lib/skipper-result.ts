// Rezultatul unei sincronizări cu skipper + textul afișat.
// Fișier fără cod de rețea, ca să poată fi importat și din componente client.

export type SyncResult = {
  ok: true
  dry_run: boolean
  grupa: string
  total_skipper: number
  adaugati: string[]
  existau: string[]
  preluati: string[]
}

// Același mesaj în pagina de admin și în pagina cu token
export function mesajSync(j: SyncResult): string {
  const parti = [
    j.adaugati.length ? `Adăugați ${j.adaugati.length}: ${j.adaugati.join(', ')}` : 'Niciun cursant nou',
    j.preluati.length ? `date preluate din sistem pentru ${j.preluati.length}` : '',
    j.existau.length ? `${j.existau.length} erau deja în listă` : '',
  ].filter(Boolean)
  return `Grupa ${j.grupa} · ${j.total_skipper} pe skipper. ${parti.join(' · ')}.`
}
