'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Save, Upload, Check, Loader2, Building2, FileImage } from 'lucide-react'

type InfoRow = { key: string; value: string; label: string; placeholder: string; type?: string }
type DocRow = { id: string; tip: string; label: string; file_data: string | null; file_name: string | null }

const INFO_FIELDS: InfoRow[] = [
  { key: 'nume_firma',           label: 'Denumire firmă',           placeholder: 'SC SET SAIL ADVERSTISING SRL', value: '' },
  { key: 'adresa',               label: 'Adresă sediu',             placeholder: 'str. Virgiliu nr. 15, etaj 3, Sector 1, București', value: '' },
  { key: 'cui',                  label: 'CUI',                      placeholder: 'RO12345678', value: '' },
  { key: 'nr_registru',          label: 'Nr. Registru Comerț',      placeholder: 'J40/1234/2020', value: '' },
  { key: 'reprezentant_legal',   label: 'Reprezentant legal',       placeholder: 'Cobianu Drugan Corna Elena', value: '' },
  { key: 'functie_reprezentant', label: 'Funcție reprezentant',     placeholder: 'Reprezentant', value: '' },
  { key: 'contact_ruxandra',     label: 'Contact notificări (nume)',placeholder: 'Ruxandra Taloș', value: '' },
  { key: 'telefon_ruxandra',     label: 'Telefon contact',          placeholder: '0727387245', value: '' },
  { key: 'email_ruxandra',       label: 'Email contact',            placeholder: 'contact@setsail.ro', value: '' },
  { key: 'cont_banca_1',         label: 'Cont bancă 1 (IBAN)',      placeholder: 'RO49 AAAA 1B31 0075 9384 0000', value: '' },
  { key: 'banca_1',              label: 'Bancă 1',                  placeholder: 'Banca Transilvania', value: '' },
  { key: 'cont_banca_2',         label: 'Cont bancă 2 (IBAN)',      placeholder: 'RO49 BBBB ...', value: '' },
  { key: 'banca_2',              label: 'Bancă 2',                  placeholder: 'ING Bank', value: '' },
]

const DOC_TIPS = [
  { tip: 'stampila_cu_semnatura',   label: 'Ștampilă cu semnătură',    desc: 'Folosită în notificările oficiale semnate' },
  { tip: 'stampila_fara_semnatura', label: 'Ștampilă fără semnătură',  desc: 'Versiune curată, fără semnătură manuscrisă' },
  { tip: 'antet',                   label: 'Antet document',           desc: 'Imaginea de antet pentru documente oficiale' },
  { tip: 'semnatura_reprezentant',  label: 'Semnătură reprezentant',   desc: 'Semnătura manuscrisă a reprezentantului legal' },
]

export default function SetSailPage() {
  const [info, setInfo] = useState<Record<string, string>>({})
  const [docs, setDocs] = useState<DocRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    supabase.from('setsail_info').select('key, value').then(({ data }) => {
      const map: Record<string, string> = {}
      data?.forEach((r: any) => { map[r.key] = r.value || '' })
      setInfo(map)
    })
    supabase.from('setsail_documents').select('*').then(({ data }) => {
      setDocs(data || [])
    })
  }, [])

  async function saveInfo() {
    setSaving(true)
    for (const [key, value] of Object.entries(info)) {
      await supabase.from('setsail_info').upsert({ key, value }, { onConflict: 'key' })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  async function uploadDoc(tip: string, file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const fileData = e.target?.result as string
      const existing = docs.find(d => d.tip === tip)
      if (existing) {
        await supabase.from('setsail_documents').update({
          file_data: fileData, file_name: file.name
        }).eq('tip', tip)
        setDocs(prev => prev.map(d => d.tip === tip ? { ...d, file_data: fileData, file_name: file.name } : d))
      } else {
        const { data } = await supabase.from('setsail_documents').insert({
          tip, label: DOC_TIPS.find(t => t.tip === tip)?.label || tip,
          file_data: fileData, file_name: file.name
        }).select().single()
        if (data) setDocs(prev => [...prev, data as DocRow])
      }
    }
    reader.readAsDataURL(file)
  }

  const inp = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
  const lbl = "block text-xs font-medium text-gray-500 mb-1.5"

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={22}/> SetSail — Date firmă
          </h1>
          <p className="text-gray-500 text-sm mt-1">Informații firmă, reprezentanți și documente oficiale</p>
        </div>
        <button onClick={saveInfo} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: saved ? '#16a34a' : '#0a1628' }}>
          {saved ? <><Check size={15}/> Salvat!</> : saving ? <><Loader2 size={15} className="animate-spin"/> Salvez...</> : <><Save size={15}/> Salvează</>}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Date firma */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>
            Informații firmă și contact
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {INFO_FIELDS.map(f => (
              <div key={f.key}>
                <label className={lbl}>{f.label}</label>
                <input className={inp} value={info[f.key] || ''} placeholder={f.placeholder}
                  onChange={e => setInfo(prev => ({ ...prev, [f.key]: e.target.value }))}/>
              </div>
            ))}
          </div>
        </div>

        {/* Documente */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
            <FileImage size={16} className="text-gray-400"/>
            Documente oficiale
          </h2>
          <div className="grid grid-cols-2 gap-5">
            {DOC_TIPS.map(({ tip, label, desc }) => {
              const doc = docs.find(d => d.tip === tip)
              return (
                <div key={tip} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    {doc?.file_data && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check size={11}/> Încărcat
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{desc}</p>
                  {doc?.file_data && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 p-2 flex items-center justify-center" style={{maxHeight: 120}}>
                      <img src={doc.file_data} alt={label} className="max-h-28 object-contain"/>
                    </div>
                  )}
                  {doc?.file_name && <p className="text-xs text-gray-400 mb-2 truncate">{doc.file_name}</p>}
                  <input type="file" accept="image/*" className="hidden"
                    ref={el => { fileRefs.current[tip] = el }}
                    onChange={e => { if (e.target.files?.[0]) uploadDoc(tip, e.target.files[0]) }}
                  />
                  <button onClick={() => fileRefs.current[tip]?.click()}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                    <Upload size={12}/> {doc?.file_data ? 'Înlocuiește' : 'Încarcă imagine'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}