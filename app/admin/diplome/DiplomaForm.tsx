'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Award, Loader2, Save } from 'lucide-react'
import {
  Diploma, DIPLOMA_CATEGORIES, DiplomaCategory, getNextDiplomaNumber, formatDiplomaDate,
} from '@/lib/diplomas'
import DateInputRO from './DateInputRO'

// Formular comun pentru adăugare manuală (diplomaId=null) și editare.
export default function DiplomaForm({ diplomaId }: { diplomaId: string | null }) {
  const router = useRouter()
  const isNew = !diplomaId
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [original, setOriginal] = useState<Diploma | null>(null)

  const [series, setSeries] = useState<DiplomaCategory>('D')
  const [number, setNumber] = useState<number | ''>('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expiration, setExpiration] = useState('')
  const [fullName, setFullName] = useState('')
  const [cnp, setCnp] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [groupName, setGroupName] = useState('')
  const [practiceLocation, setPracticeLocation] = useState('')
  const [practiceDate, setPracticeDate] = useState('')
  const [showPractice, setShowPractice] = useState(true)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [duplicate, setDuplicate] = useState(false)

  useEffect(() => {
    if (isNew) {
      getNextDiplomaNumber(supabase).then(n => setNumber(n))
      return
    }
    supabase.from('diplomas').select('*').eq('id', diplomaId).single().then(({ data }) => {
      if (!data) { alert('Diploma nu a fost găsită'); router.push('/admin/diplome'); return }
      const d = data as Diploma
      setOriginal(d)
      setSeries(d.series)
      setNumber(d.number)
      setIssueDate(d.issue_date)
      setExpiration(d.expiration || '')
      setFullName(d.full_name)
      setCnp(d.cnp || '')
      setAddress(d.address || '')
      setCity(d.city || '')
      setGroupName(d.group_name || '')
      setPracticeLocation(d.practice_location || '')
      setPracticeDate(d.practice_date || '')
      setShowPractice(d.show_practice)
      setDeliveryAddress(d.delivery_address || '')
      setDuplicate(d.duplicate)
      setLoading(false)
    })
  }, [diplomaId, isNew, router])

  async function save() {
    if (!fullName.trim() || number === '' || !issueDate) {
      alert('Numărul, numele și data eliberării sunt obligatorii.')
      return
    }
    setSaving(true)
    const payload = {
      series,
      number: Number(number),
      issue_date: issueDate,
      expiration: expiration.trim() || null,
      full_name: fullName.trim(),
      cnp: cnp.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      group_name: groupName.trim() || null,
      practice_location: practiceLocation.trim() || null,
      practice_date: practiceDate || null,
      show_practice: showPractice,
      delivery_address: deliveryAddress.trim() || null,
      duplicate,
    }
    const { error } = isNew
      ? await supabase.from('diplomas').insert({ ...payload, in_print_queue: true })
      : await supabase.from('diplomas').update(payload).eq('id', diplomaId)
    setSaving(false)
    if (error) { alert('Eroare: ' + error.message); return }
    router.push('/admin/diplome')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">

        <div className="flex items-center gap-3">
          <Link href="/admin/diplome" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Award size={18} className="text-amber-600" />
              {isNew ? 'Diplomă nouă (manual)' : `Diploma nr. ${original?.number} — ${original?.full_name}`}
            </h1>
            {!isNew && original && (
              <p className="text-xs text-gray-500">
                Creată {formatDiplomaDate(original.created_at)}
                {original.printed_at ? ` · tipărită ${formatDiplomaDate(original.printed_at)}` : ''}
                {original.delivered_at ? ` · livrată ${formatDiplomaDate(original.delivered_at)}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 grid sm:grid-cols-2 gap-4">
          <Field label="Serie (categorie)">
            <select value={series} onChange={e => setSeries(e.target.value as DiplomaCategory)} className={inputCls}>
              {DIPLOMA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Număr">
            <input type="number" value={number} onChange={e => setNumber(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Data eliberării">
            <DateInputRO value={issueDate} onChange={setIssueDate} className={inputCls} />
          </Field>
          <Field label="Expiră la (gol = nu se tipărește)">
            <input value={expiration} onChange={e => setExpiration(e.target.value)} placeholder="ex: NELIMITAT" className={inputCls} />
          </Field>
          <Field label="Nume complet (cum apare pe diplomă)">
            <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="CNP">
            <input value={cnp} onChange={e => setCnp(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Adresă (stradă, număr)">
            <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Oraș, județ">
            <input value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Serie curs">
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="ex: CDS 2026-3" className={inputCls} />
          </Field>
          <Field label="Adresă livrare (opțional)">
            <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Locația probei practice">
            <input value={practiceLocation} onChange={e => setPracticeLocation(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data probei practice">
            <DateInputRO value={practiceDate} onChange={setPracticeDate} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showPractice} onChange={e => setShowPractice(e.target.checked)} />
            Tipărește rândul „Probă practică" pe diplomă
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={duplicate} onChange={e => setDuplicate(e.target.checked)} />
            Duplicat
          </label>
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#0a1628' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? 'Creează diploma (intră în coadă)' : 'Salvează modificările'}
          </button>
        </div>

      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}
