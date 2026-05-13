'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Image as ImageIcon, Trash2, X, Star, Eye } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

const VIS_COLORS: Record<string, string> = {
  public: '#10B981',
  members: '#3B82F6',
  admin: '#6B7280',
}

export default function AdminMediaGallery({
  seasonId, media, teams, regattas,
}: {
  seasonId: string
  media: any[]
  teams: any[]
  regattas: any[]
}) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: any) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_media').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  async function toggleFeatured(id: string, current: boolean) {
    await updateField(id, 'is_featured', !current)
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest item media?')) return
    const { error } = await supabase.from('ssyt_media').delete().eq('id', id)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Adaugă media
        </button>
      </div>

      {showNew && (
        <NewMediaForm
          seasonId={seasonId}
          teams={teams}
          regattas={regattas}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); router.refresh() }}
        />
      )}

      {media.length === 0 ? (
        <div className="rounded-lg p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <ImageIcon size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun item media.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((m) => (
            <div key={m.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="aspect-video bg-gray-100 relative">
                {m.url && m.media_type === 'photo' ? (
                  <img src={m.url} alt={m.caption || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/80 text-white text-xs">
                    {m.media_type}
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold uppercase text-white" style={{ background: VIS_COLORS[m.visibility] || '#6B7280' }}>
                  {m.visibility}
                </span>
                {m.is_featured && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase text-white" style={{ background: '#FF6B35' }}>
                    ★ featured
                  </span>
                )}
              </div>
              <div className="p-3 text-xs">
                {m.caption && <p className="text-gray-700 mb-1 line-clamp-2">{m.caption}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.team && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#f3f4f6', color: '#0a1628' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.team.color_primary }}></span>
                      {m.team.short_name || m.team.name}
                    </span>
                  )}
                  {m.regatta && (
                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#f3f4f6', color: '#0a1628' }}>
                      {m.regatta.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
                  <div className="flex gap-1">
                    <select
                      value={m.visibility}
                      onChange={(e) => updateField(m.id, 'visibility', e.target.value)}
                      className="text-[10px] px-1 py-0.5 border rounded"
                    >
                      <option value="public">public</option>
                      <option value="members">members</option>
                      <option value="admin">admin</option>
                    </select>
                    <button onClick={() => toggleFeatured(m.id, m.is_featured)} className="text-gray-400 hover:text-orange-600 p-0.5" title="Toggle featured">
                      <Star size={12} fill={m.is_featured ? '#FF6B35' : 'none'} stroke={m.is_featured ? '#FF6B35' : 'currentColor'} />
                    </button>
                  </div>
                  <button onClick={() => remove(m.id)} className="text-gray-300 hover:text-red-600 p-0.5">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewMediaForm({ seasonId, teams, regattas, onClose, onSaved }: { seasonId: string; teams: any[]; regattas: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    url: '',
    caption: '',
    credit: '',
    media_type: 'photo',
    team_id: '',
    regatta_id: '',
    visibility: 'public',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!form.url.trim()) {
      setError('URL obligatoriu.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('ssyt_media').insert({
      season_id: seasonId,
      url: form.url,
      caption: form.caption || null,
      credit: form.credit || null,
      media_type: form.media_type,
      team_id: form.team_id || null,
      regatta_id: form.regatta_id || null,
      visibility: form.visibility,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Media nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <select value={form.media_type} onChange={(e) => setForm({ ...form, media_type: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          <option value="photo">photo</option>
          <option value="video">video</option>
          <option value="reel">reel</option>
        </select>
        <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          <option value="">— fără echipă —</option>
          {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={form.regatta_id} onChange={(e) => setForm({ ...form, regatta_id: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          <option value="">— fără regatta —</option>
          {regattas.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <input placeholder="URL *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <input placeholder="Caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input placeholder="Credit (autor)" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
        <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          <option value="public">public</option>
          <option value="members">members</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
      {error && <span className="ml-3 text-xs text-red-600">{error}</span>}
    </div>
  )
}