'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Check, X } from 'lucide-react'

type Entity = { id: string; [key: string]: string }

function Section({ title, table, fields }: {
  title: string
  table: string
  fields: { key: string; label: string; placeholder?: string }[]
}) {
  const [items, setItems] = useState<Entity[]>([])
  const [newItem, setNewItem] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    supabase.from(table).select('*').order(fields[0].key).then(({ data }) => setItems(data || []))
  }, [table])

  async function add() {
    if (!newItem[fields[0].key]) return
    setAdding(true)
    const { data } = await supabase.from(table).insert(newItem).select().single()
    if (data) { setItems(i => [...i, data]); setNewItem({}); setShowForm(false) }
    setAdding(false)
  }

  async function remove(id: string) {
    await supabase.from(table).delete().eq('id', id)
    setItems(i => i.filter(x => x.id !== id))
  }

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">
          <Plus size={12} /> Adaugă
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-blue-50 bg-blue-50/50">
          <div className="flex gap-2 flex-wrap">
            {fields.map(f => (
              <input key={f.key} className={inputCls} placeholder={f.placeholder || f.label}
                value={newItem[f.key] || ''}
                onChange={e => setNewItem(n => ({ ...n, [f.key]: e.target.value }))} />
            ))}
            <button onClick={add} disabled={adding}
              className="px-3 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm">
              <Check size={14} />
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 text-sm">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {items.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-400 text-center">Niciun element adăugat.</div>
        ) : items.map(item => (
          <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
            <div className="flex gap-4 flex-wrap">
              {fields.map(f => (
                <span key={f.key} className="text-sm">
                  <span className="text-gray-400 text-xs mr-1">{f.label}:</span>
                  <span className="text-gray-900">{item[f.key] || '—'}</span>
                </span>
              ))}
            </div>
            <button onClick={() => remove(item.id)} className="text-red-300 hover:text-red-500 ml-4">
              <Trash2 size={14} />
            </button>
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
        <Section title="Locații de practică" table="locations"
          fields={[
            { key: 'name', label: 'Localitate', placeholder: 'ex: Limanu' },
            { key: 'county', label: 'Județ', placeholder: 'ex: Constanța' },
          ]} />
        <Section title="Ambarcațiuni" table="boats"
          fields={[
            { key: 'name', label: 'Nume', placeholder: 'ex: SetSail' },
            { key: 'registration', label: 'Înmatriculare', placeholder: 'ex: CT-123' },
          ]} />
        <Section title="Evaluatori ANR" table="evaluators"
          fields={[
            { key: 'full_name', label: 'Nume complet', placeholder: 'POPESCU ION' },
            { key: 'title', label: 'Funcție', placeholder: 'Director CZC' },
            { key: 'decision_number', label: 'Nr. decizie', placeholder: '1565/16.09.2024' },
          ]} />
        <Section title="Instructori SetSail" table="instructors"
          fields={[
            { key: 'full_name', label: 'Nume complet', placeholder: 'POPESCU ION' },
            { key: 'email', label: 'Email', placeholder: 'email@setsail.ro' },
          ]} />
      </div>
    </div>
  )
}
