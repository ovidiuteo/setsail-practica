'use client'
import { useState } from 'react'
import { Heart, Mail, X, Send } from 'lucide-react'

const PROGRAM_TEXT = `SSYT 2026 - Racing League
4 Teams. 5 Regattas. 1 Racing Season.

Salut,

Cred că ți-ar plăcea SSYT — programul sportiv al SetSail NauticSchool pentru cursanții care vor să treacă de la sailing recreational la regatta sailing.

Nu e un curs — e o ligă competițională. Te înscrii într-o echipă, te antrenezi pe apă, concurezi în regate oficiale la Marea Neagră. La final de sezon există clasament intern și premii pentru cele mai bune echipe.

FORMATUL SEZONULUI 2026:
• 4 echipe (LIFE, DREAM, FLY, ABRACADABRA)
• 4 Beneteau First 34.7 identice
• 1 antrenament practic
• 5 regate oficiale la Marea Neagră
• Maximum 9 cursanți + 1 skipper-instructor per echipă

CUI SE ADRESEAZĂ:
Cursanți SetSail (sau echivalent) care:
• Au făcut cel puțin un curs practic de sailing
• Vor să experimenteze regatta sailing într-un cadru organizat
• Sunt disponibili pentru cel puțin 2-3 regate pe sezon
• Vor să facă parte dintr-o echipă cu identitate proprie

CE PRIMEȘTI:
• Experiență practică de regatta cu skipper-instructor
• Apartenență într-o echipă cu nucleu fix
• Acces la 5 regate oficiale + antrenament
• Roluri specifice la bord (helm, trim, bow, etc.)
• Tricou de echipă, badge-uri, fotografii
• Posibilitatea de a continua în sezoanele următoare

Vezi mai multe pe https://setsail-practica.vercel.app/ssyt/program

Și dacă vrei să aplici, formularul e aici:
https://setsail-practica.vercel.app/ssyt/apply

Pe curând!`

const DEFAULT_SUBJECT = 'Cred că ți-ar plăcea SSYT — Regatta Sailing 2026'

export default function RecommendFriendButton() {
  const [open, setOpen] = useState(false)
  const [friendEmail, setFriendEmail] = useState('')
  const [yourName, setYourName] = useState('')
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(PROGRAM_TEXT)

  function buildMailto() {
    const personalized = yourName
      ? body.replace('Pe curând!', `Pe curând,\n${yourName}`)
      : body
    return `mailto:${encodeURIComponent(friendEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(personalized)}`
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!friendEmail) return
    window.location.href = buildMailto()
    setTimeout(() => setOpen(false), 300)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-white text-sm transition hover:opacity-90"
        style={{ background: '#8B5CF6' }}
        title="Recomandă SSYT unui prieten"
      >
        <Heart size={14} />
        <span className="hidden sm:inline">Recomandă unui prieten</span>
        <span className="sm:hidden">Recomandă</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,22,40,0.7)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            style={{ background: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#8B5CF6', color: '#fff' }}>
              <div className="flex items-center gap-2">
                <Heart size={18} />
                <h2 className="font-semibold tracking-tight">Recomandă SSYT unui prieten</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSend} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Ajută-ne să creștem comunitatea. Recomandă SSYT unui prieten cu care ai naviga împreună —
                  formularul de mai jos va deschide aplicația de email cu mesajul pre-completat.
                </p>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Email-ul prietenului <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    placeholder="prieten@example.com"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: '#d1d5db' }}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Numele tău (opțional, apare la semnătură)
                  </label>
                  <input
                    type="text"
                    value={yourName}
                    onChange={(e) => setYourName(e.target.value)}
                    placeholder="ex: Andrei"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: '#d1d5db' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: '#d1d5db' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                    Mesaj (poți edita)
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border rounded-md text-xs font-mono focus:outline-none focus:ring-2 resize-y"
                    style={{ borderColor: '#d1d5db' }}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Poți modifica textul. La semnătură vei vedea automat numele tău dacă l-ai completat.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ background: '#f8f9fa', borderColor: '#e5e7eb' }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 transition"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={!friendEmail}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md font-medium text-white text-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#8B5CF6' }}
                >
                  <Send size={14} />
                  Deschide email-ul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
