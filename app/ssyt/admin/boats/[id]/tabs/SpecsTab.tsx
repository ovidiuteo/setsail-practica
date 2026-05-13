'use client'
import { useState } from 'react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

export default function SpecsTab({ boat, specs, onSaved }: { boat: any; specs: any | null; onSaved: () => void }) {
  const [localSpecs, setLocalSpecs] = useState<any>(specs || {})

  async function ensureSpecs(): Promise<string> {
    if (localSpecs?.id) return localSpecs.id
    const { data, error } = await supabase
      .from('ssyt_boat_specs')
      .insert({ boat_id: boat.id })
      .select('*')
      .single()
    if (error) throw error
    setLocalSpecs(data)
    return data.id
  }

  async function saveField(field: string, value: string) {
    await ensureSpecs()
    const cleanValue = value === '' ? null : value
    const { data, error } = await supabase
      .from('ssyt_boat_specs')
      .update({ [field]: cleanValue })
      .eq('boat_id', boat.id)
      .select('*')
      .single()
    if (error) {
      alert('Eroare: ' + error.message)
      throw error
    }
    setLocalSpecs(data)
    onSaved()
  }

  const sections: { title: string; fields: { key: string; label: string; unit?: string; type?: any }[] }[] = [
    {
      title: 'Identitate & istoric',
      fields: [
        { key: 'designer', label: 'Designer' },
        { key: 'builder', label: 'Builder' },
        { key: 'country', label: 'Țară' },
        { key: 'year_first_built', label: 'An început', type: 'number' },
        { key: 'year_last_built', label: 'An final', type: 'number' },
        { key: 'hulls_built', label: 'Coci construite', type: 'number' },
      ],
    },
    {
      title: 'Cocă',
      fields: [
        { key: 'hull_type', label: 'Tip cocă' },
        { key: 'construction', label: 'Construcție' },
        { key: 'loa_m', label: 'LOA (lungime totală)', unit: 'm', type: 'number' },
        { key: 'lwl_m', label: 'LWL (linie plutire)', unit: 'm', type: 'number' },
        { key: 'beam_m', label: 'Beam (lățime)', unit: 'm', type: 'number' },
        { key: 'draft_m', label: 'Draft (pescaj)', unit: 'm', type: 'number' },
      ],
    },
    {
      title: 'Greutate',
      fields: [
        { key: 'displacement_kg', label: 'Deplasament', unit: 'kg', type: 'number' },
        { key: 'ballast_kg', label: 'Balast', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: 'Apendici cocă',
      fields: [
        { key: 'keel_type', label: 'Tip chilă' },
        { key: 'rudder_type', label: 'Tip cârmă' },
      ],
    },
    {
      title: 'Velatură (Rig)',
      fields: [
        { key: 'rig_type', label: 'Tip rig' },
        { key: 'sailplan', label: 'Sailplan' },
        { key: 'i_height_m', label: 'I (înălțime triunghi)', unit: 'm', type: 'number' },
        { key: 'j_base_m', label: 'J (baza triunghi)', unit: 'm', type: 'number' },
        { key: 'p_main_luff_m', label: 'P (luff randă)', unit: 'm', type: 'number' },
        { key: 'e_main_foot_m', label: 'E (foot randă)', unit: 'm', type: 'number' },
      ],
    },
    {
      title: 'Suprafețe vele',
      fields: [
        { key: 'mainsail_area_m2', label: 'Suprafață randă', unit: 'm²', type: 'number' },
        { key: 'jib_area_m2', label: 'Suprafață jib/genoa', unit: 'm²', type: 'number' },
        { key: 'upwind_sail_area_m2', label: 'Suprafață upwind totală', unit: 'm²', type: 'number' },
        { key: 'spinnaker_area_m2', label: 'Suprafață spinnaker', unit: 'm²', type: 'number' },
      ],
    },
    {
      title: 'Motor',
      fields: [
        { key: 'engine_make', label: 'Marcă motor' },
        { key: 'engine_hp', label: 'Putere', unit: 'HP', type: 'number' },
        { key: 'engine_type', label: 'Tip motor' },
      ],
    },
    {
      title: 'Rapoarte performanță',
      fields: [
        { key: 'sa_disp_ratio', label: 'SA/Disp ratio', type: 'number' },
        { key: 'ballast_disp_ratio', label: 'Ballast/Disp ratio', unit: '%', type: 'number' },
        { key: 'disp_length_ratio', label: 'Disp/Length ratio', type: 'number' },
      ],
    },
    {
      title: 'Certificare',
      fields: [
        { key: 'ce_category', label: 'Categorie CE' },
      ],
    },
  ]

  return (
    <div className="space-y-5">
      {/* Descriere */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Descriere</div>
        <EditableField
          value={localSpecs.description}
          onSave={(v) => saveField('description', v)}
          placeholder="Adaugă descriere..."
          type="textarea"
          multiline
          displayClassName="text-sm text-gray-700 leading-relaxed block w-full"
        />
      </div>

      {/* Secțiuni tehnice grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">{section.title}</h3>
            <dl className="space-y-2">
              {section.fields.map((f) => (
                <div key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-gray-500 flex-shrink-0">{f.label}</dt>
                  <dd className="text-right" style={{ color: '#0a1628' }}>
                    <EditableField
                      value={localSpecs[f.key]}
                      onSave={(v) => saveField(f.key, v)}
                      type={f.type || 'text'}
                      placeholder="—"
                      formatDisplay={(val) => {
                        if (val === null || val === undefined || val === '') return '—'
                        return f.unit ? `${val} ${f.unit}` : String(val)
                      }}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Source */}
      <div className="rounded-lg p-4 text-xs text-gray-500" style={{ background: '#f8f9fa', border: '1px solid #e5e7eb' }}>
        <span className="font-medium text-gray-600">Sursa: </span>
        <EditableField
          value={localSpecs.source_url}
          onSave={(v) => saveField('source_url', v)}
          placeholder="URL sursă"
          type="url"
        />
      </div>
    </div>
  )
}
