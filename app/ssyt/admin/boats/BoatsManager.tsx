'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Sailboat, Edit2, Trash2, X, Check, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type Boat = {
  id: string
  name: string
  model: string | null
  sail_number: string | null
  hull_color: string | null
  capacity: number
  is_active: boolean
  notes: string | null
  teams?: any[]
}

export default function BoatsManager({ initialBoats }: { initialBoats: Boat[] }) {
  const router = useRouter()
  const [boats, setBoats] = useState<Boat[]>(initialBoats)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  async function refresh() {
    const { data } = await supabase
      .from('ssyt_boats')
      .select('*, teams:ssyt_teams(id, name, short_name, color_primary, status)')
      .order('name')
    if (data) setBoats(data as Boat[])
    router.refresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition"
          style={{ background: '#FF6B35' }}
        >
          <Plus size={14} /> Adaugă ambarcațiune
        </button>
      </div>

      {showNew && (
        <BoatNewForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); refresh() }} />
      )}

      {boats.length > 0 ? (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Model</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Sail nr.</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Cap.</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Activ</th>
                <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {boats.map((b) => {
                const usedByTeam = (b.teams || []).find((t: any) => t.status === 'active')
                if (editingId === b.id) {
                  return (
                    <BoatEditRow
                      key={b.id}
                      boat={b}
                      onCancel={() => setEditingId(null)}
                      onSaved={() => { setEditingId(null); refresh() }}
                    />
                  )
                }
                return (
                  <tr key={b.id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-5 py-3 font-semibold">
                      <Link
                        href={`/ssyt/admin/boats/${b.id}`}
                        className="inline-flex items-center gap-2 hover:underline transition"
                        style={{ color: '#FF6B35' }}
                      >
                        <Sailboat size={14} />
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{b.model || '—'}</td>
                    <td className="px-5 py-3 text-gray-700 font-mono text-xs">{b.sail_number || '—'}</td>
                    <td className="px-5 py-3 text-center text-gray-700">{b.capacity}</td>
                    <td className="px-5 py-3">
                      {usedByTeam ? (
                        <Link
                          href={`/ssyt/admin/teams/${usedByTeam.id}`}
                          className="inline-flex items-center gap-1.5 text-xs hover:underline"
                          style={{ color: '#0a1628' }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: usedByTeam.color_primary || '#4A5568' }}></span>
                          {usedByTeam.short_name || usedByTeam.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 italic text-xs">— liberă</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                        background: b.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                        color: b.is_active ? '#10B981' : '#6B7280',
                      }}>
                        {b.is_active ? 'activ' : 'inactiv'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/ssyt/admin/boats/${b.id}`} className="text-gray-400 hover:text-gray-700 p-1 inline-block" title="Detalii complete">
                        <ExternalLink size={14} />
                      </Link>
                      <button onClick={() => setEditingId(b.id)} className="text-gray-400 hover:text-gray-700 p-1 ml-1" title="Editare rapidă">
                        <Edit2 size={14} />
                      </button>
                      <DeleteBoatButton boatId={b.id} canDelete={!usedByTeam} onDeleted={refresh} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Sailboat size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nicio ambarcațiune.</p>
        </div>
      )}
    </div>
  )
}

function BoatNewForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    model: 'Beneteau First 34.7',
    sail_number: '',
    capacity: 10,
  })
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!form.name.trim()) {
      setError('Numele este obligatoriu')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('ssyt_boats').insert({
      name: form.name,
      model: form.model || null,
      sail_number: form.sail_number || null,
      capacity: form.capacity,
      is_active: true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Ambarcațiune nouă</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Nume *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Model</label>
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Sail nr.</label>
          <input value={form.sail_number} onChange={(e) => setForm({ ...form, sail_number: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Capacitate</label>
          <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-md text-sm text-white font-medium" style={{ background: '#FF6B35' }}>
          {saving ? '...' : 'Salvează'}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}

function BoatEditRow({ boat, onCancel, onSaved }: { boat: Boat; onCancel: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: boat.name,
    model: boat.model || '',
    sail_number: boat.sail_number || '',
    capacity: boat.capacity,
    is_active: boat.is_active,
  })

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('ssyt_boats').update({
      name: form.name,
      model: form.model || null,
      sail_number: form.sail_number || null,
      capacity: form.capacity,
      is_active: form.is_active,
    }).eq('id', boat.id)
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <tr style={{ background: 'rgba(255,107,53,0.04)', borderTop: '1px solid #FF6B35' }}>
      <td className="px-5 py-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
      </td>
      <td className="px-5 py-2">
        <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
      </td>
      <td className="px-5 py-2">
        <input value={form.sail_number} onChange={(e) => setForm({ ...form, sail_number: e.target.value })} className="w-full px-2 py-1 border rounded text-sm font-mono" />
      </td>
      <td className="px-5 py-2">
        <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="w-16 px-2 py-1 border rounded text-sm text-center" />
      </td>
      <td className="px-5 py-2 text-xs text-gray-400">—</td>
      <td className="px-5 py-2 text-center">
        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
      </td>
      <td className="px-5 py-2 text-right">
        <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:text-green-800"><Check size={14} /></button>
        <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700 ml-1"><X size={14} /></button>
      </td>
    </tr>
  )
}

function DeleteBoatButton({ boatId, canDelete, onDeleted }: { boatId: string; canDelete: boolean; onDeleted: () => void }) {
  async function handleDelete() {
    if (!canDelete) {
      alert('Nu poți șterge o ambarcațiune alocată unei echipe active.')
      return
    }
    if (!confirm('Ștergi această ambarcațiune?')) return
    const { error } = await supabase.from('ssyt_boats').delete().eq('id', boatId)
    if (error) {
      alert('Eroare: ' + error.message)
      return
    }
    onDeleted()
  }
  return (
    <button
      onClick={handleDelete}
      className="text-gray-400 hover:text-red-600 p-1 ml-1"
      title={canDelete ? 'Șterge' : 'Folosită de o echipă'}
      style={{ opacity: canDelete ? 1 : 0.4 }}
    >
      <Trash2 size={14} />
    </button>
  )
}