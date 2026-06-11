'use client'
import React, { useEffect, useState } from 'react'

// Input de dată cu afișare românească dd.mm.yyyy.
// Valoarea expusă rămâne ISO (yyyy-mm-dd), cum o așteaptă Supabase.

function toRO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

function toISO(text: string): string | null {
  const t = text.trim()
  if (!t) return ''
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t)
  if (!m) return null
  const [, d, mo, y] = m
  const day = Number(d), month = Number(mo)
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function DateInputRO({ value, onChange, className }: {
  value: string
  onChange: (iso: string) => void
  className?: string
}) {
  const [text, setText] = useState(() => toRO(value))

  // sincronizează când valoarea se schimbă din exterior (ex. selectarea sesiunii)
  useEffect(() => { setText(toRO(value)) }, [value])

  function commit() {
    const iso = toISO(text)
    if (iso === null) {
      setText(toRO(value)) // invalid → revine la ultima valoare bună
      return
    }
    onChange(iso)
    setText(toRO(iso))
  }

  return (
    <input
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
      placeholder="zz.ll.aaaa"
      inputMode="numeric"
      className={className}
    />
  )
}
