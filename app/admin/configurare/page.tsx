'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'

type Entity = { id: string; [key: string]: string }
type Field = { key: string; label: string; placeholder?: string }

function Section({ title, table, fields }: {
  title: string
  table: string
  fields: Field[]
}) {
  const [items, setItems] = useState<Entity[]>([])
  const [newItem, setNewItem] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from(table).select('*').order(fields[0].key).then(({ data }) => setItems(data || []))
  }, [table])

  async function add() {
    if (!newItem[fields[0].key]) return
    setAdding(true)
    const { data } = await supabase.from(table).insert(newItem).select().single()
    if (data) { setItems(i => [...i, data as Entity]); setNewItem({}); setShowAddForm(false) }
    setAdding(false)
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest element?')) return
    await supabase.from(table).delete().eq('id', id)
    setItems(i => i.filter(x => x.id !== id))
  }

  function startEdit(item: Entity) {
    setEditingId(item.id)
    const vals: Record<string, string> = {}
    fields.forEach(f => { vals[f.key] = item[f.key] || '' })
    setEditValues(vals)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const { data } = await supabase.from(table).update(editValues).eq('id', id).select().single()
    if (data) {
      setItems(i => i.map(x => x.id === id ? { ...x, ...editValues } : x))
    }
    setEditingId(null)
    setEditValues({})
    setSaving(false)
  }

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 min-w-0"
  const editInputCls = "border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button onClick={() => { setShowAddForm(true); setEditingId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          <Plus size={12} /> Adaugă
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 border-b border-blue-50 bg-blue-50/50">
          <div className="flex gap-2 flex-wrap items-end">
            {fields.map(f => (
              <div key={f.key} className="flex-1 min-w-28">
                <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                <input className={inputCls} placeholder={f.placeholder || f.label}
                  value={newItem[f.key] || ''}
                  onChange={e => setNewItem(n => ({ ...n, [f.key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && add()} />
              </div>
            ))}
            <div className="flex gap-1.5 shrink-0">
              <button onClick={add} disabled={adding}
                className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                <Check size={15} />
              </button>
              <button onClick={() => { setShowAddForm(false); setNewItem({}) }}
                className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-400 text-center">Niciun element adăugat.</div>
        ) : items.map(item => (
          <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
            {editingId === item.id ? (
              <div className="flex gap-2 items-end flex-wrap">
                {fields.map((f, fi) => (
                  <div key={f.key} className="flex-1 min-w-28">
                    <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                    <input className={editInputCls}
                      value={editValues[f.key] || ''}
                      onChange={e => setEditValues(v => ({ ...v, [f.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus={fi === 0} />
                  </div>
                ))}
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => saveEdit(item.id)} disabled={saving}
                    className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                    <Check size={15} />
                  </button>
                  <button onClick={cancelEdit}
                    className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-4 flex-wrap flex-1 min-w-0">
                  {fields.map(f => (
                    <span key={f.key} className="text-sm min-w-0">
                      <span className="text-gray-400 text-xs mr-1">{f.label}:</span>
                      <span className="text-gray-900 font-medium">{item[f.key] || '—'}</span>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(item)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                    title="Editează">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(item.id)}
                    className="p-1.5 rounded-lg border border-gray-100 text-red-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                    title="Șterge">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ConfigurarePage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Configurare</h1>
        <p className="text-gray-500 text-sm mt-1">Gestionare locații, ambarcațiuni, evaluatori și instructori</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Section title="📍 Locații de practică" table="locations"
          fields={[
            { key: 'name', label: 'Localitate', placeholder: 'ex: Limanu' },
            { key: 'county', label: 'Județ', placeholder: 'ex: Constanța' },
            { key: 'location_detail', label: 'Adresă detaliată', placeholder: 'ex: Lac Snagov – complex Delta Snagov, str. Nicolae Grigorescu, sat Izvorani, comuna Ciolpani' },
          ]} />
        <Section title="⛵ Ambarcațiuni" table="boats"
          fields={[
            { key: 'name', label: 'Nume', placeholder: 'ex: SetSail' },
            { key: 'registration', label: 'Înmatriculare', placeholder: 'ex: CT-123' },
          ]} />
        <Section title="🏛️ Evaluatori ANR" table="evaluators"
          fields={[
            { key: 'full_name', label: 'Nume complet', placeholder: 'POPESCU ION' },
            { key: 'title', label: 'Functie', placeholder: 'Director CZC' },
            { key: 'decision_number', label: 'Nr. decizie', placeholder: '1565/16.09.2024' },
            { key: 'email_oficial', label: 'Email oficial comunicari', placeholder: 'autorizari@rna.ro' },
            { key: 'email_personal', label: 'Email personal', placeholder: 'nume@email.ro' },
            { key: 'address_serviciu', label: 'Adresa serviciu', placeholder: 'Str. Portului nr. 1' },
            { key: 'address_personal', label: 'Adresa personala', placeholder: 'Str. Exemplu nr. 1' },
            { key: 'phone_serviciu', label: 'Telefon serviciu', placeholder: '0241 123 456' },
            { key: 'phone_personal', label: 'Telefon personal', placeholder: '07XX XXX XXX' },
          ]} />
        <Section title="👤 Instructori SetSail" table="instructors"
          fields={[
            { key: 'full_name', label: 'Nume complet', placeholder: 'POPESCU ION' },
            { key: 'email', label: 'Email', placeholder: 'email@setsail.ro' },
          ]} />
      </div>
    </div>
  )
}