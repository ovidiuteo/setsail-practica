// Status efectiv al unei regate pentru afișare.
// Stările explicite (completed/cancelled/draft) rămân; altfel se derivă din date:
//   data trecută -> 'passed', în desfășurare -> 'live', viitor -> 'upcoming'.

export type RegattaStatusInput = {
  status?: string | null
  start_date: string
  end_date?: string | null
}

export function effectiveRegattaStatus(r: RegattaStatusInput): string {
  if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'draft') return r.status
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(r.start_date); start.setHours(0, 0, 0, 0)
  const end = r.end_date ? new Date(r.end_date) : start; end.setHours(0, 0, 0, 0)
  if (today > end) return 'passed'
  if (today >= start && today <= end) return 'live'
  return 'upcoming'
}

export const REGATTA_STATUS_COLORS: Record<string, string> = {
  upcoming: '#3B82F6',
  live: '#EF4444',
  passed: '#9CA3AF',
  completed: '#10B981',
  cancelled: '#6B7280',
  draft: '#9CA3AF',
}

export function regattaStatusColor(status: string): string {
  return REGATTA_STATUS_COLORS[status] || '#6B7280'
}
