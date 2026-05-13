'use client'
import { useState } from 'react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

export default function RegattaOverviewTab({ regatta, onSaved }: { regatta: any; onSaved: () => void }) {
  const [local, setLocal] = useState<any>(regatta)

  async function saveField(field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { data, error } = await supabase
      .from('ssyt_regattas')
      .update({ [field]: cleanValue })
      .eq('id', regatta.id)
      .select('*')
      .single()
    if (error) {
      alert('Eroare: ' + error.message)
      throw error
    }
    setLocal(data)
    onSaved()
  }

  const sections = [
    {
      title: 'Identitate eveniment',
      fields: [
        { key: 'name', label: 'Nume' },
        { key: 'short_name', label: 'Short name' },
        { key: 'slug', label: 'Slug URL' },
        { key: 'event_type', label: 'Tip eveniment', type: 'select', options: [
          { value: 'regatta', label: 'regatta' },
          { value: 'training', label: 'training' },
          { value: 'briefing', label: 'briefing' },
          { value: 'social', label: 'social' },
        ]},
        { key: 'status', label: 'Status', type: 'select', options: [
          { value: 'draft', label: 'draft' },
          { value: 'upcoming', label: 'upcoming' },
          { value: 'live', label: 'live' },
          { value: 'completed', label: 'completed' },
          { value: 'cancelled', label: 'cancelled' },
        ]},
        { key: 'visibility', label: 'Vizibilitate', type: 'select', options: [
          { value: 'public', label: 'public' },
          { value: 'members', label: 'members' },
          { value: 'admin', label: 'admin' },
        ]},
      ],
    },
    {
      title: 'Locație & timp',
      fields: [
        { key: 'start_date', label: 'Data început', type: 'date' },
        { key: 'end_date', label: 'Data sfârșit', type: 'date' },
        { key: 'start_time', label: 'Ora start prima cursă', type: 'text' },
        { key: 'location', label: 'Locație' },
        { key: 'marina', label: 'Marina' },
      ],
    },
    {
      title: 'Briefing & comunicații',
      fields: [
        { key: 'briefing_time', label: 'Briefing time (ISO)', type: 'text' },
        { key: 'briefing_location', label: 'Briefing location' },
        { key: 'vhf_channel', label: 'Canal VHF' },
        { key: 'emergency_contact', label: 'Contact urgență' },
        { key: 'race_committee', label: 'Comitet de regată' },
      ],
    },
    {
      title: 'Format & punctaj',
      fields: [
        { key: 'expected_races', label: 'Curse planificate', type: 'number' },
        { key: 'points_multiplier', label: 'Multiplicator puncte', type: 'number' },
      ],
    },
    {
      title: 'Link-uri externe',
      fields: [
        { key: 'notice_of_race_url', label: 'Notice of Race URL', type: 'url' },
        { key: 'sailing_instructions_url', label: 'Sailing Instructions URL', type: 'url' },
        { key: 'official_results_url', label: 'Rezultate oficiale URL', type: 'url' },
        { key: 'external_event_url', label: 'Site eveniment URL', type: 'url' },
      ],
    },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Descriere</div>
        <EditableField
          value={local.description}
          onSave={(v) => saveField('description', v)}
          placeholder="Adaugă descriere..."
          type="textarea"
          multiline
          displayClassName="text-sm text-gray-700 leading-relaxed block w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">{section.title}</h3>
            <dl className="space-y-2">
              {section.fields.map((f: any) => (
                <div key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-gray-500 flex-shrink-0">{f.label}</dt>
                  <dd className="text-right max-w-[60%]" style={{ color: '#0a1628' }}>
                    <EditableField
                      value={local[f.key]}
                      onSave={(v) => saveField(f.key, v)}
                      type={f.type || 'text'}
                      options={f.options}
                      placeholder="—"
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}