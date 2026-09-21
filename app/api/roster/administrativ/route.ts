import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { titleCaseRo, whatsappText } from '@/lib/print-docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Datele pentru tab-ul „Administrativ" din lista cu token: foaia de prezență și
// pagina cu cele 3 coduri QR (aceleași ca în pagina de admin a sesiunii).
//   GET ?session_id=&token= -> { catalog: {...}, qr: {...} }

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

export async function GET(req: NextRequest) {
  const sb = svc()
  const sessionId = req.nextUrl.searchParams.get('session_id') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  const { data: sess } = await sb.from('sessions')
    .select('id, roster_token, session_date, course_start_date, practice_start_date, class_caa, timeline_scope, parent_session_id, session_type, is_clone')
    .eq('id', sessionId).maybeSingle()
  if (!sessionId || !token || !sess?.roster_token || sess.roster_token !== token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const s = sess as any
  const sd = s.session_date
  const csd = s.course_start_date || s.practice_start_date || sd
  const parentId = s.parent_session_id || null

  // Grupa: seria principală = Grupa 1, clonele = Grupa 2, 3, …
  let grupaNr = 1
  if (parentId) {
    const { data: cl } = await sb.from('sessions').select('id, created_at')
      .eq('parent_session_id', parentId).eq('session_type', 'clone').order('created_at')
    const idx = (cl || []).findIndex((x: any) => x.id === s.id)
    grupaNr = idx >= 0 ? idx + 2 : 2
  }

  const ro = (a: string, b: string) => a.localeCompare(b, 'ro', { sensitivity: 'base' })
  const nume = (arr: any[]) => (arr || []).filter((x: any) => (x.full_name || '').trim()).map((x: any) => titleCaseRo(x.full_name))

  const { data: own } = await sb.from('students')
    .select('full_name, order_in_session').eq('session_id', s.id).eq('only_sailing', false).order('order_in_session')
  let numeLista = nume(own)
  if (grupaNr === 2 && parentId) {
    // lista 2: cursanții ei, apoi cei de la sailing (înregistrați pe seria principală)
    const { data: sail } = await sb.from('students').select('full_name').eq('session_id', parentId).eq('only_sailing', true)
    numeLista = [...numeLista, ...nume(sail).sort(ro)]
  } else {
    numeLista = [...numeLista].sort(ro)
  }

  // titlul listei 2 e cel al seriei principale
  let titlu = titluPrezenta(csd, sd)
  if (parentId) {
    const { data: p } = await sb.from('sessions')
      .select('session_date, course_start_date, practice_start_date').eq('id', parentId).maybeSingle()
    if (p) titlu = titluPrezenta((p as any).course_start_date || (p as any).practice_start_date || (p as any).session_date, (p as any).session_date)
  }

  // QR-urile: cele salvate pe serie + skipper (default global) + comunitatea la seriile motor
  const wa = whatsappText(s)
  const [{ data: sk }, { data: q }] = await Promise.all([
    sb.from('setsail_documents').select('file_data').eq('tip', 'qr_skipper').maybeSingle(),
    sb.from('session_qr').select('portal, whatsapp, luna, an').eq('session_id', s.id).maybeSingle(),
  ])
  let whatsapp = (q as any)?.whatsapp || null
  if (!whatsapp && wa.comunitate) {
    const { data: c } = await sb.from('setsail_documents').select('file_data').eq('tip', 'qr_whatsapp_motor').maybeSingle()
    whatsapp = (c as any)?.file_data || null
  }
  const acum = new Date()

  return NextResponse.json({
    catalog: { titlu, grupa: 'Grupa ' + grupaNr, zile: zileCurs(csd, sd), nume: numeLista },
    qr: {
      luna: (q as any)?.luna || dRo(sd || acum.toISOString(), { month: 'long' }).toUpperCase(),
      an: (q as any)?.an || String(sd ? new Date(sd).getFullYear() : acum.getFullYear()),
      portal: (q as any)?.portal || null,
      skipper: (sk as any)?.file_data || null,
      whatsapp,
      wa,
    },
  })
}
