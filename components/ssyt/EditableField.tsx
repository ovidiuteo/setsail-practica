'use client'
import { useState, useRef, useEffect } from 'react'
import { Check, X, Pencil } from 'lucide-react'

type Props = {
  value: string | number | null
  onSave: (newValue: string) => Promise<void>
  placeholder?: string
  type?: 'text' | 'number' | 'date' | 'url' | 'email' | 'tel' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  className?: string
  displayClassName?: string
  inputClassName?: string
  emptyLabel?: string
  multiline?: boolean
  // Optional formatare valoare afisare
  formatDisplay?: (val: string | number | null) => string
}

export default function EditableField({
  value,
  onSave,
  placeholder = 'Adaugă...',
  type = 'text',
  options,
  className = '',
  displayClassName = '',
  inputClassName = '',
  emptyLabel,
  multiline = false,
  formatDisplay,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if ('select' in inputRef.current) inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    setDraft(value?.toString() ?? '')
  }, [value])

  async function commit() {
    if (draft === (value?.toString() ?? '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setDraft(value?.toString() ?? '')
    setEditing(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') cancel()
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      commit()
    }
  }

  if (editing) {
    const inputStyle = `flex-1 px-2 py-1 border rounded text-sm bg-white ${inputClassName}`
    return (
      <div className={`inline-flex items-center gap-1.5 w-full ${className}`}>
        {type === 'textarea' || multiline ? (
          <textarea
            ref={inputRef as any}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={3}
            className={inputStyle}
            style={{ borderColor: '#FF6B35', outline: 'none', boxShadow: '0 0 0 2px rgba(255,107,53,0.15)' }}
          />
        ) : type === 'select' && options ? (
          <select
            ref={inputRef as any}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            className={inputStyle}
            style={{ borderColor: '#FF6B35', outline: 'none', boxShadow: '0 0 0 2px rgba(255,107,53,0.15)' }}
          >
            <option value="">—</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as any}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className={inputStyle}
            style={{ borderColor: '#FF6B35', outline: 'none', boxShadow: '0 0 0 2px rgba(255,107,53,0.15)' }}
          />
        )}
        <button onClick={commit} disabled={saving} className="p-1 text-green-600 hover:text-green-800" title="Salvează (Enter)">
          <Check size={14} />
        </button>
        <button onClick={cancel} className="p-1 text-gray-400 hover:text-gray-700" title="Anulează (Esc)">
          <X size={14} />
        </button>
      </div>
    )
  }

  const isEmpty = value === null || value === undefined || value === ''
  const displayValue = formatDisplay ? formatDisplay(value) : (value?.toString() ?? '')

  return (
    <span
      onClick={() => setEditing(true)}
      className={`group cursor-pointer inline-flex items-center gap-1.5 hover:bg-orange-50 rounded px-1 -mx-1 py-0.5 transition ${displayClassName}`}
      title="Click pentru editare"
    >
      <span className={isEmpty ? 'italic text-gray-400' : ''}>
        {isEmpty ? (emptyLabel || placeholder) : displayValue}
      </span>
      <Pencil size={11} className="opacity-0 group-hover:opacity-50 text-gray-500 flex-shrink-0" />
    </span>
  )
}
