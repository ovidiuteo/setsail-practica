import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncSkipper, esteEroare } from '@/lib/skipper-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Verificarea periodică a grupelor de pe skipper: pentru fiecare sesiune care are
// link, aduce cursanții apăruți între timp. Sesiunea intră în monitorizare din
// momentul în care i s-a completat linkul (skipper_url_set_at) și iese a doua zi
// după examen (session_date = ziua examenului, la radio ca și la ANR).
//
// Se apelează cu Authorization: Bearer <CRON_SECRET> (așa trimite Vercel Cron)
// sau cu ?secret=<CRON_SECRET> — pentru declanșatoare externe.
function autorizat(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  return req.nextUrl.searchParams.get('secret') === secret
}

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!autorizat(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = svc()
  // Ziua de azi în ora României — sesiunile trecute nu se mai verifică
  const azi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
  const acumMinus = (zile: number) => {
    const [y, m, d] = azi.split('-').map(Number)
    const x = new Date(y, m - 1, d - zile)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }

  // Doar sesiunile principale (clonele au același link și ar dubla cursanții),
  // care au link, care au intrat în monitorizare și al căror examen n-a trecut de
  // ieri — ultima zi de verificare e ziua de după examen.
  const { data: sesiuni, error } = await sb.from('sessions')
    .select('id, session_date, class_caa, skipper_url')
    .not('skipper_url', 'is', null).neq('skipper_url', '')
    .not('skipper_url_set_at', 'is', null)
    .eq('session_type', 'principal')
    .neq('status', 'completed')
    .gte('session_date', acumMinus(1))
    .order('session_date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const acum = new Date().toISOString()
  const raport: any[] = []

  for (const s of sesiuni || []) {
    const r = await syncSkipper(sb, s.id)
    if (esteEroare(r)) {
      raport.push({ sesiune: s.id, data: s.session_date, eroare: r.error })
      continue
    }
    // marcăm verificarea chiar dacă n-a adus pe nimeni — asta e „Last cron job"
    await sb.from('sessions')
      .update({ skipper_synced_at: acum, skipper_last_added: r.adaugati.length })
      .eq('id', s.id)
    raport.push({
      sesiune: s.id, data: s.session_date, grupa: r.grupa,
      total_skipper: r.total_skipper, adaugati: r.adaugati,
    })
  }

  return NextResponse.json({ ok: true, la: acum, sesiuni_verificate: raport.length, raport })
}
