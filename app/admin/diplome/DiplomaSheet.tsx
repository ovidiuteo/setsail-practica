'use client'
import React from 'react'
import {
  PAGE_W, PAGE_H, BG_OFFSET_X, BG_OFFSET_Y,
  DIPLOMA_FIELD_DEFS, FieldDef, TemplateFields, fieldBox, formatDiplomaDate,
} from '@/lib/diplomas'

// Foaia de diplomă: suprafață fixă 1123x794 px (A4 landscape @ 96dpi).
// Replication 1:1 a print-diploma.blade.php din vechiul sistem, ca să putem
// importa coordonatele calibrate de acolo fără modificări.
// Imaginea-model e fundal DOAR pe ecran — clasa .diploma-bg e ascunsă la print.

export type SheetData = {
  number: number | string
  issue_date: string
  expiration: string | null
  full_name: string
  cnp: string | null
  address: string | null
  city: string | null
  group_name: string | null
  practice_location: string | null
  practice_date: string | null
  show_practice: boolean
}

export function fieldText(d: SheetData, key: string): string {
  switch (key) {
    case 'base_number':
    case 'number': return String(d.number)
    case 'base_name_1':
    case 'base_name_2':
    case 'name': return (d.full_name || '').toUpperCase()
    case 'base_date_1':
    case 'base_date_2':
    case 'date': return formatDiplomaDate(d.issue_date)
    case 'base_group':
    case 'group': return d.group_name || ''
    case 'expiration': return d.expiration || ''
    case 'address': return d.address || ''
    case 'city': return d.city || ''
    case 'cnp': return d.cnp || ''
    case 'practice':
      return d.show_practice
        ? `Probă practică: ${d.practice_location || ''} / ${formatDiplomaDate(d.practice_date)}`
        : ''
    default: return ''
  }
}

export default function DiplomaSheet({
  data, fields, color, category,
  interactive = false, selectedKey = null, onFieldPointerDown,
}: {
  data: SheetData
  fields: TemplateFields
  color: string
  category: string
  interactive?: boolean
  selectedKey?: string | null
  onFieldPointerDown?: (key: string, e: React.PointerEvent) => void
}) {
  const base = fieldBox(fields, 'base')
  const diploma = fieldBox(fields, 'diploma')

  function renderField(def: FieldDef) {
    const box = fieldBox(fields, def.key)
    const groupOffset = def.group === 'base' ? base : diploma
    const text = def.kind === 'text' ? fieldText(data, def.key) : null
    if (def.kind === 'text' && !text && !interactive) return null

    const style: React.CSSProperties = {
      position: 'absolute',
      top: groupOffset.top + box.top,
      left: groupOffset.left + box.left,
      width: box.width ?? 100,
      fontSize: def.fontSize ?? 14,
      textAlign: def.align ?? 'left',
      fontStyle: def.italic ? 'italic' : undefined,
      color,
      lineHeight: 1.2,
      cursor: interactive ? 'move' : undefined,
      userSelect: interactive ? 'none' : undefined,
      outline: interactive
        ? (selectedKey === def.key ? '2px solid #f59e0b' : '1px dashed rgba(245,158,11,.55)')
        : undefined,
      background: interactive ? 'rgba(245, 197, 66, .18)' : undefined,
      touchAction: interactive ? 'none' : undefined,
    }

    return (
      <div
        key={def.key}
        data-field={def.key}
        style={style}
        onPointerDown={interactive && onFieldPointerDown ? e => onFieldPointerDown(def.key, e) : undefined}
        title={interactive ? def.label : undefined}
      >
        {def.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={def.image} alt={def.label} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
        ) : (
          text || (interactive ? `[${def.label}]` : '')
        )}
      </div>
    )
  }

  return (
    <section
      className="diploma-sheet"
      style={{
        position: 'relative',
        width: PAGE_W,
        height: PAGE_H,
        overflow: 'hidden',
        fontFamily: 'Calibri, "Segoe UI", sans-serif',
        fontWeight: 600,
      }}
    >
      {/* Fundal doar pe ecran (foaia reală e pre-tipărită) */}
      <div
        className="diploma-bg"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(/images/diplomas/model-diploma-${category.toLowerCase()}.jpg)`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${BG_OFFSET_X}px ${BG_OFFSET_Y}px`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0 }}>
        {DIPLOMA_FIELD_DEFS.map(renderField)}
      </div>
    </section>
  )
}
