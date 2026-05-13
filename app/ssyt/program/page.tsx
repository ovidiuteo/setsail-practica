import Link from 'next/link'
import { ArrowRight, Users, Anchor, Calendar, Trophy, Check } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 60

export default async function ProgramPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="py-20 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const { data: content } = await supabase
    .from('ssyt_program_content')
    .select('*')
    .eq('season_id', season.id)
    .maybeSingle()

  return (
    <div>
      {/* Hero */}
      <section style={{ background: '#0a1628' }} className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-white text-4xl md:text-6xl font-bold tracking-tight mb-6" style={{ letterSpacing: '-0.03em' }}>
            {content?.hero_title || 'Despre program'}
          </h1>
          {content?.hero_subtitle && (
            <p className="text-white/70 text-xl md:text-2xl font-medium">{content.hero_subtitle}</p>
          )}
        </div>
      </section>

      {/* Intro */}
      {content?.intro && (
        <section className="max-w-3xl mx-auto px-6 py-16">
          <MarkdownProse text={content.intro} />
        </section>
      )}

      {/* Format */}
      {content?.format_description && (
        <section style={{ background: '#fff' }} className="border-t border-b">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <SectionHeader label="Format" title="Cum funcționează sezonul" />
            <div className="max-w-3xl">
              <MarkdownProse text={content.format_description} />
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users size={20} />} value="4" label="Echipe" />
          <StatCard icon={<Anchor size={20} />} value="4" label="Beneteau First 34.7" />
          <StatCard icon={<Calendar size={20} />} value="5" label="Regatte" />
          <StatCard icon={<Trophy size={20} />} value="9+1" label="Membri / echipă" />
        </div>
      </section>

      {/* Who should apply */}
      {content?.who_should_apply && (
        <section style={{ background: '#fff' }} className="border-t">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <SectionHeader label="Cui i se adresează" title="Pentru cine este SSYT" />
            <div className="max-w-3xl">
              <MarkdownProse text={content.who_should_apply} />
            </div>
          </div>
        </section>
      )}

      {/* What you get */}
      {content?.what_you_get && (
        <section className="max-w-5xl mx-auto px-6 py-16 border-t">
          <SectionHeader label="Beneficii" title="Ce primești" />
          <div className="max-w-3xl">
            <MarkdownProse text={content.what_you_get} />
          </div>
        </section>
      )}

      {/* Requirements */}
      {content?.requirements && (
        <section style={{ background: '#fff' }} className="border-t border-b">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <SectionHeader label="Cerințe" title="Ce ai nevoie să aplici" />
            <div className="max-w-3xl">
              <MarkdownProse text={content.requirements} />
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      {content?.pricing_info && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <SectionHeader label="Cost" title="Investiție" />
          <div className="max-w-3xl">
            <MarkdownProse text={content.pricing_info} />
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-2xl p-10 md:p-16 text-center" style={{ background: '#0a1628' }}>
          <h2 className="text-white text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ letterSpacing: '-0.02em' }}>
            Gata să aplici?
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
            Aplicarea pentru sezonul {season.year} este deschisă. Completezi formularul în 5 minute.
          </p>
          <Link
            href="/ssyt/apply"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-md font-medium text-white hover:opacity-90 transition"
            style={{ background: '#FF6B35' }}
          >
            Aplică pentru SSYT{season.year}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>{label}</p>
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
        {title}
      </h2>
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="p-5 rounded-lg text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="inline-flex items-center justify-center mb-3" style={{ color: '#FF6B35' }}>
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

// Markdown simplu: bold pe ** ** + liste pe - + paragrafe
function MarkdownProse({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let currentList: string[] = []
  let key = 0

  function flushList() {
    if (currentList.length > 0) {
      blocks.push(
        <ul key={`list-${key++}`} className="space-y-2 mb-4">
          {currentList.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-700 leading-relaxed">
              <Check size={16} className="mt-1 flex-shrink-0" style={{ color: '#FF6B35' }} />
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushList()
      continue
    }
    if (line.startsWith('- ')) {
      currentList.push(line.substring(2))
      continue
    }
    flushList()
    blocks.push(
      <p key={`p-${key++}`} className="text-gray-700 leading-relaxed mb-4 text-lg" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
    )
  }
  flushList()
  return <>{blocks}</>
}

function formatInline(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0a1628;font-weight:600">$1</strong>')
}