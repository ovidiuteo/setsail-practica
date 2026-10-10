'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, NotebookPen, X } from 'lucide-react'
import { CURS_B } from '@/lib/curs-b/continut'

type Cursant = { id: string; full_name: string; class_caa: string; grupa: string }

// Numele pe coloană: „POPESCU I." — cât să încapă, dar să se recunoască omul
function numeScurt(n: string) {
  const p = String(n || '').trim().split(/\s+/)
  if (p.length < 2) return p[0] || '—'
  return `${p[0]} ${p[1][0]}.`
}

export default function CaieteCursBPage() {
  const { id } = useParams<{ id: string }>()
  const [cursanti, setCursanti] = useState<Cursant[]>([])
  const [note, setNote] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState('')
  const [celula, setCelula] = useState<{ cursant: Cursant; titlu: string; text: string } | null>(null)

  useEffect(() => {
    if (!id) return
    let anulat = false
    fetch(`/api/admin/caiete-curs-b?session_id=${id}`)
      .then(r => r.json())
      .then(d => {
        if (anulat) return
        if (d.error) { setEroare(d.error); return }
        setCursanti(d.cursanti || [])
        setNote(d.note || {})
      })
      .catch(e => { if (!anulat) setEroare(String(e)) })
      .finally(() => { if (!anulat) setLoading(false) })
    return () => { anulat = true }
  }, [id])

  const subiecte = useMemo(
    () => CURS_B.flatMap(zi => zi.subiecte.map(s => ({ ...s, zi: zi.zi, ziTitlu: zi.titlu }))),
    [],
  )
  const scris = (studentId: string, cheie: string) => String(note[studentId]?.[cheie] || '').trim()

  // Cât a completat fiecare cursant din tot caietul
  const perCursant = useMemo(() => {
    const r: Record<string, number> = {}
    for (const c of cursanti) r[c.id] = subiecte.filter(s => scris(c.id, s.cheie)).length
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursanti, note, subiecte])

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin" /> Se încarcă caietele...
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/sesiuni/${id}`} className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
            <NotebookPen size={20} className="text-sky-600" /> Caiete de lucru
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cursul B/A — subiectele pe verticală, cursanții pe orizontală. Click pe o bifă ca să citești ce a scris.
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {cursanti.length} cursanți · {subiecte.length} subiecte
        </div>
      </div>

      {eroare && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{eroare}</div>
      )}

      {cursanti.length === 0 ? (
        <p className="text-sm text-gray-400">Nu există cursanți în această serie.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-auto max-h-[78vh]">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 min-w-[16rem]">
                  Subiect
                </th>
                <th className="sticky top-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-center font-semibold text-gray-500 w-14">
                  Scris
                </th>
                {cursanti.map(c => (
                  <th key={c.id} title={c.full_name}
                    className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 w-24">
                    <div className="truncate">{numeScurt(c.full_name)}</div>
                    <div className="text-[10px] font-normal text-gray-400">
                      {c.class_caa || '—'} · {perCursant[c.id]}/{subiecte.length}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CURS_B.map(zi => (
                <Fragment key={`zi-${zi.zi}`}>
                  {/* Capătul zilei, ca separator */}
                  <tr>
                    <td colSpan={2 + cursanti.length}
                      className="bg-sky-50 border-y border-sky-100 px-3 py-1.5 font-semibold text-sky-800">
                      Ziua {zi.zi} — {zi.titlu} <span className="font-normal text-sky-600">· {zi.instructor}</span>
                    </td>
                  </tr>
                  {zi.subiecte.map(s => {
                    const cati = cursanti.filter(c => scris(c.id, s.cheie)).length
                    return (
                      <tr key={s.cheie} className="hover:bg-gray-50/70">
                        <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-3 py-1.5 text-gray-700">
                          {s.titlu}
                        </td>
                        <td className={`border-b border-r border-gray-100 px-2 py-1.5 text-center font-medium ${
                          cati === 0 ? 'text-gray-300' : cati === cursanti.length ? 'text-green-600' : 'text-amber-600'}`}>
                          {cati}/{cursanti.length}
                        </td>
                        {cursanti.map(c => {
                          const text = scris(c.id, s.cheie)
                          return (
                            <td key={c.id} className="border-b border-gray-100 px-1 py-1.5 text-center">
                              {text ? (
                                <button onClick={() => setCelula({ cursant: c, titlu: s.titlu, text })}
                                  title={text.slice(0, 300)}
                                  className="inline-flex items-center justify-center min-w-[2.2rem] px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium">
                                  {text.length}
                                </button>
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Cifra din celulă e numărul de caractere scrise de cursant la subiectul respectiv.
      </p>

      {/* Ce a scris cursantul */}
      {celula && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">{celula.titlu}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {celula.cursant.full_name} · clasa {celula.cursant.class_caa || '—'}
                </p>
              </div>
              <button onClick={() => setCelula(null)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{celula.text}</p>
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-gray-100">
              <button onClick={() => setCelula(null)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
