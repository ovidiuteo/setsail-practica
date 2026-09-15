// Contractul de prestări servicii Set Sail Yachting (SSY), generat ca DOCX.
// Textul e cel din modelul „contract SSY"; datele variabile vin din factura
// încărcată / textul importat la acte contabile (extrase cu AI), corectabile înainte.
// Formatarea (siglă, spațieri, bold, indentări) urmează PDF-ul modelului.

export type ContractSsyData = {
  nr: string                     // ex. SSY631
  data: string                   // data contractului, YYYY-MM-DD
  beneficiar_tip: 'pf' | 'pj'
  beneficiar_nume: string
  beneficiar_adresa: string
  beneficiar_cnp: string         // persoană fizică
  beneficiar_cui: string         // persoană juridică
  beneficiar_reg_com: string     // persoană juridică
  beneficiar_reprezentant: string // persoană juridică, opțional
  eveniment: string              // ex. „Eveniment nautic pe Marea Neagră"
  perioada_start: string         // YYYY-MM-DD
  perioada_end: string           // YYYY-MM-DD (= start pentru o singură zi)
  suma: number
  moneda: 'RON' | 'EUR'
  plata: string                  // fraza despre modul de plată
}

export const PLATA_IMPLICITA = 'Plata se va efectua pe baza facturii fiscale emise de SC Set Sail Yachting SRL.'
export const EVENIMENT_IMPLICIT = 'Eveniment nautic'

const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie',
  'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

// 'YYYY-MM-DD' <-> Date locală (fără alunecări de fus orar)
export function zi(d: string): Date | null {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number)
  return y && m && dd ? new Date(y, m - 1, dd) : null
}
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const scurt = (d: string) => { const x = zi(d); return x ? `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}` : '' }
const lung = (d: string) => { const x = zi(d); return x ? `${x.getDate()} ${LUNI[x.getMonth()]} ${x.getFullYear()}` : '' }

// Când factura nu spune perioada evenimentului: de la o săptămână după data
// contractului până la 30 octombrie (al aceluiași an; dacă începutul trece de
// 30 octombrie, până la 30 octombrie anul următor).
export function perioadaImplicita(dataContract: string): { start: string; end: string } {
  const c = zi(dataContract) || new Date()
  const start = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7)
  let end = new Date(start.getFullYear(), 9, 30)
  if (start > end) end = new Date(start.getFullYear() + 1, 9, 30)
  return { start: iso(start), end: iso(end) }
}

// Ca în model: contractul își produce efectele până a doua zi după eveniment
export function sfarsitContract(perioadaEnd: string): string {
  const e = zi(perioadaEnd)
  if (!e) return ''
  return iso(new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1))
}

// Format românesc: 1.313,55 (fără zecimale la sume întregi: 1.600)
const sumaText = (n: number) => {
  const r = Math.round((Number(n) || 0) * 100) / 100
  const zec = Number.isInteger(r) ? 0 : 2
  const [intreg, fractie] = r.toFixed(zec).split('.')
  const cuPuncte = intreg.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return fractie ? `${cuPuncte},${fractie}` : cuPuncte
}

export type SiglaContract = { data: Buffer; type: 'png' | 'jpg'; width: number; height: number }

// ── Conținutul contractului, o singură dată, pentru DOCX și pentru PDF ──
type Run = { text: string; bold?: boolean; size?: number }   // size în jumătăți de punct (22 = 11 pt)
type Bloc = {
  runs: Run[]
  align: 'left' | 'center' | 'justify'
  before?: number                // spațiu deasupra, în twips (240 = un rând)
  after?: number
  indent?: boolean               // primul rând retras
  keepNext?: boolean             // rămâne pe pagină cu paragraful următor
}

const RAND = 240                 // un rând liber între blocuri, ca în model
const INDENT = 280               // retragerea primului rând la 5.x, 7.x, 8.x, 9.x

function numeBeneficiar(d: ContractSsyData) {
  return String(d.beneficiar_nume || '').trim().toUpperCase() || '..............................'
}

function blocuriContract(d: ContractSsyData): Bloc[] {
  const t = (text: string, o: Partial<Bloc> = {}): Bloc => ({ runs: [{ text }], align: 'justify', ...o })
  // Titlurile de capitol sunt normale (nu bold), cu un rând liber deasupra
  const titlu = (text: string): Bloc => t(text, { before: RAND, align: 'left', keepNext: true })
  const art = (text: string): Bloc => t(text, { indent: true })

  const numeBen = numeBeneficiar(d)
  const beneficiar: Run[] = d.beneficiar_tip === 'pj'
    ? [
        { text: `${numeBen},`, bold: true },
        { text: ` persoană juridică română, cu sediul în ${d.beneficiar_adresa || '..............................'}, cod fiscal ${d.beneficiar_cui || '..........'}, nr. de înregistrare la Registrul Comerțului ${d.beneficiar_reg_com || '..........'}${d.beneficiar_reprezentant ? `, reprezentată prin ${d.beneficiar_reprezentant}` : ''}, denumită în continuare Beneficiar.` },
      ]
    : [
        { text: `${numeBen},`, bold: true },
        { text: ` cu domiciliul în ${d.beneficiar_adresa || '..............................'}, având CNP ${d.beneficiar_cnp || '..............'}, denumit(ă) în continuare Beneficiar.` },
      ]

  const oZi = d.perioada_start && (!d.perioada_end || d.perioada_end === d.perioada_start)
  const cand = oZi ? `în data de ${lung(d.perioada_start)}` : `în perioada ${lung(d.perioada_start)} – ${lung(d.perioada_end)}`
  const valoare = d.moneda === 'EUR' ? `${sumaText(d.suma)} EUR, echivalent în RON` : `${sumaText(d.suma)} RON`

  return [
    { runs: [{ text: 'CONTRACT DE PRESTĂRI SERVICII', bold: true, size: 30 }], align: 'center' },
    { runs: [{ text: `nr. ${d.nr || '..........'} din data de ${scurt(d.data) || '..........'}`, size: 24 }], align: 'center', after: RAND * 2 },

    t('1. Părțile contractante', { align: 'left', keepNext: true }),
    { runs: [
      { text: 'S.C. SET SAIL YACHTING SRL:', bold: true },
      { text: ' persoană juridică română, cu sediul în București, Str. Știrbei-Vodă, nr. 152, bl. 26 B, sc. 4, et. 4, ap. 12, Sector 1, cod fiscal 34825339, nr. de înregistrare la Registrul Comerțului J40/9294/2015, reprezentată prin Drugan Paula-Loredana, denumită în continuare Prestator' },
    ], align: 'justify', after: RAND * 1.5 },
    t('și,', { align: 'left', after: RAND * 1.5 }),
    { runs: beneficiar, align: 'justify' },

    titlu('2. Obiectul contractului'),
    t('Instruirea de către Prestator a reprezentantului Beneficiarului în cadrul cursului:'),
    { runs: [{ text: `${d.eveniment || EVENIMENT_IMPLICIT} ${cand}`, bold: true }], align: 'left', before: RAND },

    titlu('3. Durata contractului'),
    t(`Contractul își produce efectele de la data semnării sale de către părți și până la data de ${scurt(sfarsitContract(d.perioada_end || d.perioada_start)) || '..........'}.`),

    titlu('4. Prețul contractului'),
    { runs: [{ text: `Valoarea totală a contractului este de ${valoare}`, bold: true }], align: 'left' },
    t(d.plata || PLATA_IMPLICITA),
    t('Plățile se vor efectua conform contractului, fie prin ordin de plată în conturile menționate pe documentul de plată, fie în numerar.'),
    t('În cazul în care suma va fi ofertată în EURO, plata se va calcula în lei la cursul BNR din ziua facturării de către PRESTATOR.'),
    t('Plata facturii se va face în termen de 7 zile de la data facturării. Întârzierea la plata facturii va fi penalizată cu 0,15% pe zi calendaristică de întârziere.'),

    titlu('5. Obligațiile părților'),
    t('a) Obligațiile Prestatorului', { align: 'left', keepNext: true }),
    art('5.1.1 Să organizeze evenimentul așa cum a fost el prezentat Beneficiarului, cu respectarea condițiilor de siguranță oportune.'),
    art('5.1.2 Să restituie suma încasată drept contravaloare a serviciilor în cazul în care, din motive imputabile Prestatorului, serviciile nu pot fi finalizate.'),
    art('5.1.3 Să constituie suma încasată drept contravaloare a serviciilor ca voucher valoric în cazul în care, din motive NEIMPUTABILE atât Prestatorului cât și Beneficiarului, serviciile nu pot fi finalizate.'),
    t('b) Obligațiile Beneficiarului', { align: 'left', keepNext: true }),
    art('5.2.1 Să achite valoarea facturii în termen de 7 zile de la data facturării.'),
    art('5.2.2 Să respecte indicațiile Prestatorului pe durata evenimentului, privind organizarea, desfășurarea și siguranța evenimentului și a participanților.'),
    art('5.2.3 Să citească cu atenție, să semneze și să-și însușească normele de conduită / termenii și condițiile în cadrul evenimentului în cazul în care sunt prevăzute într-un document separat.'),

    titlu('6. GDPR'),
    t('6.1 Părțile trebuie să respecte normele și obligațiile impuse de dispozițiile în vigoare, privind protecția datelor cu caracter personal, așa cum reiese din normele europene din Regulamentul 679/2016 se aplică oricărei persoane juridice care prelucrează date cu caracter personal sau care furnizează servicii.'),
    t('6.2 Părțile pot utiliza datele personale ale semnatarilor în limita contractului pe care îl au încheiat, acesta fiind baza legală a prelucrării; orice prelucrare suplimentară sau în alt scop face obiectul unui acord separat de prelucrare a datelor, încheiat între Părți. De asemenea, perioada de stocare a datelor personale prelucrate prin contract este limitată la perioada corespondentă realizării obiectului principal al contractului.'),
    t('6.3 Datele cu caracter personal schimbate între Părți nu pot deveni accesibile sau comunicate unor terțe părți neautorizate sau puse la dispoziție spre utilizare într-un alt mod.'),
    t('6.4 Beneficiarul își exprimă expres acordul ca Prestatorul să efectueze fotografii și filmări video ale evenimentului în care pot apărea accidental sau expres Beneficiarul sau reprezentanții acestuia. Prestatorul deține toate drepturile intelectuale ale materialelor foto/video rezultate și le poate folosi în activitatea sa.'),

    titlu('7. Litigii'),
    art('7.1 Orice litigiu decurgând din sau în legătură cu acest contract, inclusiv referitor la validitatea, interpretarea, executarea sau desființarea lui, se va soluționa pe cale amiabilă.'),
    art('7.2 În cazul în care soluționarea pe cale amiabilă nu se realizează, competența de soluționare a litigiilor aparține instanțelor judecătorești competente.'),

    titlu('8. Proprietatea intelectuală'),
    art('8.1 Toate drepturile decurgând din proprietatea intelectuală asupra cursurilor, modelelor, schițelor, planșelor, precum și a oricărui material scris, audio, video sau software folosit de Prestator în procesul de învățământ aparțin SC SET SAIL YACHTING SRL.'),
    art('8.2 Este interzisă orice reproducere, de orice fel, prin orice mijloace, a materialelor menționate anterior. În cazul în care Beneficiarul încalcă această obligație, el va răspunde în condițiile Legii nr. 8/1996 privind drepturile de autor și drepturile conexe.'),

    titlu('9. Dispoziții finale'),
    art('9.1 Părțile declară că între ele nu a mai intervenit nicio altă înțelegere și că prezentul contract este singurul contract intervenit între Prestator și Beneficiar.'),
    art('9.2 Orice alte declarații/acorduri anterioare, indiferent dacă sunt în formă scrisă sau orală, nu produc niciun fel de efecte juridice între părți, decât în măsura în care ele sunt incluse și în prezentul contract.'),
    art('9.3 Părțile la prezentul contract se obligă să nu transmită în niciun fel, către terțe persoane, drepturile și obligațiile sale, rezultând din prezentul contract.'),
    art('9.4 Prezentul contract s-a încheiat în 2 (două) exemplare, câte unul pentru fiecare parte.'),
  ]
}

// Rândul 2 al semnăturii beneficiarului: „prin X" la firme cu reprezentant, altfel „[beneficiar]"
function semnaturaBeneficiar(d: ContractSsyData): Run[] {
  return d.beneficiar_tip === 'pj' && d.beneficiar_reprezentant
    ? [{ text: 'prin ', bold: true }, { text: d.beneficiar_reprezentant }] : [{ text: '[beneficiar]' }]
}

export function numeFisierContract(d: ContractSsyData) {
  return `Contract ${d.nr || 'SSY'} - ${d.beneficiar_nume}`.replace(/[\\/:*?"<>|]+/g, ' ').trim()
}

export async function buildContractSsyDocx(d: ContractSsyData, sigla?: SiglaContract | null): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
    WidthType, BorderStyle, ImageRun, convertMillimetersToTwip,
  } = await import('docx')

  const FONT = 'Arial'
  const SZ = 22
  const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, justify: AlignmentType.JUSTIFIED }
  const runs = (rs: Run[]) => rs.map(x => new TextRun({ text: x.text, font: FONT, size: x.size ?? SZ, bold: x.bold }))
  const par = (b: Bloc) => new Paragraph({
    alignment: ALIGN[b.align],
    spacing: { before: b.before ?? 0, after: b.after ?? 0 },
    indent: b.indent ? { firstLine: INDENT } : undefined,
    keepNext: b.keepNext,
    keepLines: true,
    children: runs(b.runs),
  })

  const children: any[] = []

  // Sigla, stânga sus (doar pe prima pagină, ca în model)
  if (sigla) {
    const W = 165
    const H = Math.round(W * sigla.height / Math.max(1, sigla.width))
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new ImageRun({ data: sigla.data, type: sigla.type, transformation: { width: W, height: H } })],
    }))
  }
  blocuriContract(d).forEach(b => children.push(par(b)))

  // Semnăturile, pe două coloane: Prestatorul la stânga, Beneficiarul centrat în dreapta
  const fara = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const bordere = { top: fara, bottom: fara, left: fara, right: fara }
  const celula = (paragrafe: any[]) => new TableCell({
    borders: bordere,
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: paragrafe,
  })
  children.push(new Paragraph({ spacing: { before: RAND * 2 }, children: [] }))
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: fara, bottom: fara, left: fara, right: fara, insideHorizontal: fara, insideVertical: fara },
    rows: [new TableRow({
      cantSplit: true,
      children: [
        celula([
          par({ runs: [{ text: 'SC SET SAIL YACHTING SRL', bold: true }], align: 'left' }),
          new Paragraph({ indent: { left: INDENT }, children: runs([{ text: 'prin ', bold: true }, { text: 'Drugan Paula-Loredana' }]) }),
        ]),
        celula([
          par({ runs: [{ text: numeBeneficiar(d), bold: true }], align: 'center' }),
          par({ runs: semnaturaBeneficiar(d), align: 'center' }),
        ]),
      ],
    })],
  }))

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(15), bottom: convertMillimetersToTwip(20),
            left: convertMillimetersToTwip(25), right: convertMillimetersToTwip(25),
          },
        },
      },
      children,
    }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

// PDF = pagină HTML deschisă în tab nou și tipărită (Salvează ca PDF), ca la
// celelalte documente. Aceleași blocuri și spațieri ca în DOCX.
export function buildContractSsyHtml(d: ContractSsyData, o: { sigla: string | null; stampila: string | null }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const pt = (tw?: number) => `${(tw || 0) / 20}pt`
  const runs = (rs: Run[]) => rs.map(x => {
    const style = x.size ? ` style="font-size:${x.size / 2}pt"` : ''
    const t = esc(x.text)
    return x.bold ? `<b${style}>${t}</b>` : style ? `<span${style}>${t}</span>` : t
  }).join('')
  const par = (b: Bloc) =>
    `<p class="${b.keepNext ? 'kn' : ''}" style="text-align:${b.align};margin:${pt(b.before)} 0 ${pt(b.after)} 0;${b.indent ? `text-indent:${pt(INDENT)};` : ''}">${runs(b.runs)}</p>`

  const titlu = numeFisierContract(d) + (o.stampila ? '' : ' (nesemnat)')
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<title>${esc(titlu)}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 25mm 20mm 25mm; }
  html { background: #e0e0e0; padding: 20px; }
  body {
    font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.15; color: #000;
    background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 25mm 20mm 25mm;
    box-sizing: border-box; box-shadow: 0 0 20px rgba(0,0,0,.3);
  }
  p { orphans: 2; widows: 2; break-inside: avoid; }
  p.kn { break-after: avoid; page-break-after: avoid; }
  .sigla { display: block; width: 165px; height: auto; margin-bottom: 8pt; }
  .semnaturi { display: flex; margin-top: 24pt; break-inside: avoid; page-break-inside: avoid; }
  .semnaturi > div { width: 50%; }
  .semnaturi p { margin: 0; }
  .stampila { display: block; height: 125px; width: auto; margin: 2px 0 0 0; mix-blend-mode: multiply; }
  @media print {
    html { background: #fff; padding: 0; }
    body { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  }
</style>
</head>
<body>
${o.sigla ? `<img class="sigla" src="${o.sigla}" alt="SetSail">` : ''}
${blocuriContract(d).map(par).join('\n')}
<div class="semnaturi">
  <div>
    <p><b>SC SET SAIL YACHTING SRL</b></p>
    <p style="padding-left:${pt(INDENT)}"><b>prin</b> Drugan Paula-Loredana</p>
    ${o.stampila ? `<img class="stampila" src="${o.stampila}" alt="Semnătură și ștampilă">` : ''}
  </div>
  <div style="text-align:center">
    <p><b>${esc(numeBeneficiar(d))}</b></p>
    <p>${runs(semnaturaBeneficiar(d))}</p>
  </div>
</div>
</body>
</html>`
}
