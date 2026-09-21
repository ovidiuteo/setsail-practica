import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { titleCaseRo, whatsappText } from '@/lib/print-docs'
import { zileIntre, etichetaZi, titluCatalog } from '@/lib/catalog-zile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tab-ul „Administrativ" din lista cu token: foile de prezență (câte una pe grupă)
// și pagina A4 cu cele 3 coduri QR — aceleași ca în pagina de admin a sesiunii.
//   GET  ?session_id=&token=                        -> { cataloage: [...], qr: {...} }
//   POST { session_id, token, portal?, skipper?, whatsapp?, luna?, an? } -> salvează QR-urile

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

const dRo = (v: string | null, o: Intl.DateTimeFormatOptions) => v ? new Date(v).toLocaleDateString('ro-RO', o) : ''

// Zilele de curs: de la data de start până la practică; altfel Luni–Joi
function zileCurs(start: string | null, final: string | null): string[] {
  if (!start || !final) return ['Luni', 'Marți', 'Miercuri', 'Joi']
  const a = new Date(start), b = new Date(final)
  if (isNaN(+a) || isNaN(+b) || b < a) return ['Luni', 'Marți', 'Miercuri', 'Joi']
  const out: string[] = []
  for (const t = new Date(a); t <= b && out.length < 10; t.setDate(t.getDate() + 1)) {
    const w = t.toLocaleDateString('ro-RO', { weekday: 'long' })
    out.push(w.charAt(0).toLocaleUpperCase('ro-RO') + w.slice(1))
  }
  return out.length ? out : ['Luni', 'Marți', 'Miercuri', 'Joi']
}

function titluPrezenta(start: string | null, final: string | null): string {
  const a = start ? String(new Date(start).getDate()) : ''
  const b = final ? String(new Date(final).getDate()) : ''
  const luna = dRo(final, { month: 'long' })
  const an = final ? String(new Date(final).getFullYear()) : ''
  return `Prezență ${a && b ? a + '-' + b + ' ' : ''}${luna} ${an}`.replace(/\s+/g, ' ').trim()
}

// Seria principală + clonele ei, în ordinea creării (Grupa 1, 2, 3…)
async function familie(sb: ReturnType<typeof svc>, sessionId: string) {
  const { data: s } = await sb.from('sessions')
    .select('id, roster_token, parent_session_id, session_date, course_start_date, practice_start_date, class_caa, timeline_scope, catalog_zile')
    .eq('id', sessionId).maybeSingle()
  if (!s) return null
  const principalId = (s as any).parent_session_id || (s as any).id
  const { data: principal } = await sb.from('sessions')
    .select('id, session_date, course_start_date, practice_start_date, class_caa, timeline_scope, catalog_zile')
    .eq('id', principalId).maybeSingle()
  const { data: clone } = await sb.from('sessions')
    .select('id, session_date, course_start_date, practice_start_date')
    .eq('parent_session_id', principalId).eq('session_type', 'clone').order('created_at')
  return { sess: s as any, principal: (principal || s) as any, clone: (clone || []) as any[] }
}

export async function GET(req: NextRequest) {
  const sb = svc()
  const sessionId = req.nextUrl.searchParams.get('session_id') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  const fam = await familie(sb, sessionId)
  if (!sessionId || !token || !fam || fam.sess.roster_token !== token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { principal, clone } = fam
  const sd = principal.session_date
  const csd = principal.course_start_date || principal.practice_start_date || sd
  // zilele de curs: cele bifate în setările catalogului, altfel toate din interval
  const toateZilele = zileIntre(csd, sd)
  const aleseSalvate = Array.isArray(principal.catalog_zile) ? (principal.catalog_zile as string[]).filter(z => toateZilele.includes(z)) : null
  const zileAlese = aleseSalvate && aleseSalvate.length ? aleseSalvate : toateZilele
  const zile = zileAlese.length ? zileAlese.map(etichetaZi) : zileCurs(csd, sd)
  // titlul urmează extremele zilelor bifate
  const titlu = zileAlese.length ? titluCatalog(zileAlese) : titluPrezenta(csd, sd)

  const ro = (a: string, b: string) => a.localeCompare(b, 'ro', { sensitivity: 'base' })
  const nume = (arr: any[]) => (arr || []).filter((x: any) => (x.full_name || '').trim()).map((x: any) => titleCaseRo(x.full_name))

  const grupe = [principal, ...clone]
  const cataloage = await Promise.all(grupe.map(async (g: any, i: number) => {
    const { data: own } = await sb.from('students')
      .select('full_name, order_in_session').eq('session_id', g.id).eq('only_sailing', false).order('order_in_session')
    let lista = nume(own)
    if (i === 1) {
      // grupa 2 primește și cursanții de sailing, înregistrați pe seria principală
      const { data: sail } = await sb.from('students').select('full_name').eq('session_id', principal.id).eq('only_sailing', true)
      lista = [...lista, ...nume(sail).sort(ro)]
    } else {
      lista = [...lista].sort(ro)
    }
    return { grupa: i + 1, eticheta: 'Grupa ' + (i + 1), titlu, zile, nume: lista }
  }))

  // QR-urile: cele salvate pe serie + skipper (default global) + comunitatea la seriile motor
  const wa = whatsappText(principal)
  const [{ data: sk }, { data: q }] = await Promise.all([
    sb.from('setsail_documents').select('file_data').eq('tip', 'qr_skipper').maybeSingle(),
    sb.from('session_qr').select('portal, whatsapp, luna, an, updated_at').eq('session_id', principal.id).maybeSingle(),
  ])
  let whatsapp = (q as any)?.whatsapp || null
  if (!whatsapp && wa.comunitate) {
    const { data: c } = await sb.from('setsail_documents').select('file_data').eq('tip', 'qr_whatsapp_motor').maybeSingle()
    whatsapp = (c as any)?.file_data || null
  }
  const acum = new Date()

  return NextResponse.json({
    interval: { start: csd || null, final: sd || null, zile_alese: zileAlese },
    cataloage,
    qr: {
      luna: (q as any)?.luna || dRo(sd || acum.toISOString(), { month: 'long' }).toUpperCase(),
      an: (q as any)?.an || String(sd ? new Date(sd).getFullYear() : acum.getFullYear()),
      portal: (q as any)?.portal || null,
      skipper: (sk as any)?.file_data || null,
      whatsapp,
      salvat_la: (q as any)?.updated_at || null,
      wa,
    },
  })
}

// Salvează QR-urile seriei (și pe cel de skipper ca default global)
export async function POST(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  const fam = await familie(sb, String(body.session_id || ''))
  if (!fam || !body.token || fam.sess.roster_token !== body.token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  // zilele bifate pentru catalog (se țin pe seria principală)
  if (Array.isArray(body.catalog_zile)) {
    const valide = (body.catalog_zile as any[]).filter(z => typeof z === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(z))
    const { error } = await sb.from('sessions').update({ catalog_zile: valide }).eq('id', fam.principal.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!body.portal && !body.skipper && !body.whatsapp && body.luna === undefined) {
      return NextResponse.json({ ok: true, catalog_zile: valide })
    }
  }

  const img = (v: unknown) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) ? v : null
  const portal = img(body.portal)
  const skipper = img(body.skipper)
  const whatsapp = img(body.whatsapp)
  const acum = new Date().toISOString()

  const { error } = await sb.from('session_qr').upsert({
    session_id: fam.principal.id,
    portal, whatsapp,
    luna: String(body.luna || '').slice(0, 30),
    an: String(body.an || '').slice(0, 10),
    updated_at: acum,
  }, { onConflict: 'session_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // QR-ul platformei e același pentru toate seriile: îl ținem ca default global
  if (skipper) {
    const { data } = await sb.from('setsail_documents').select('id').eq('tip', 'qr_skipper').maybeSingle()
    if ((data as any)?.id) await sb.from('setsail_documents').update({ file_data: skipper, label: 'QR skipper', file_name: 'qr_skipper.png' }).eq('id', (data as any).id)
    else await sb.from('setsail_documents').insert({ tip: 'qr_skipper', file_data: skipper, label: 'QR skipper', file_name: 'qr_skipper.png' })
  }
  return NextResponse.json({ ok: true, salvat_la: acum })
}
