// ============================================================================
// SSYT - mapare centralizata pentru tipurile de membership
// ============================================================================
// 3 tipuri:
//   core       - membru permanent al echipei
//   occasional - membru care vine ocazional la regate
//   punctual   - membru one-time, default confirmed la prima regata viitoare,
//                apoi tentative la regatele de dupa (daca ramane in echipa)
// ============================================================================

export type MembershipType = 'core' | 'occasional' | 'punctual'

export const MEMBERSHIP_TYPES: MembershipType[] = ['core', 'occasional', 'punctual']

export type MembershipStyle = {
  label: string
  short: string
  bg: string
  fg: string
  description: string
}

export const MEMBERSHIP_STYLES: Record<MembershipType, MembershipStyle> = {
  core: {
    label: 'Core',
    short: 'core',
    bg: 'rgba(255,107,53,0.12)',
    fg: '#FF6B35',
    description: 'Membru permanent al echipei',
  },
  occasional: {
    label: 'Ocazional',
    short: 'occasional',
    bg: 'rgba(0,168,181,0.12)',
    fg: '#00A8B5',
    description: 'Vine ocazional la regate',
  },
  punctual: {
    label: 'One-time',
    short: 'punctual',
    bg: 'rgba(168,85,247,0.12)',
    fg: '#a855f7',
    description: 'O singură dată — confirmat default la prima regată, apoi indecis',
  },
}

export function styleFor(type: string | null | undefined): MembershipStyle {
  if (type && type in MEMBERSHIP_STYLES) {
    return MEMBERSHIP_STYLES[type as MembershipType]
  }
  // fallback pentru valori necunoscute (afișaj generic)
  return {
    label: type ?? '—',
    short: type ?? '—',
    bg: '#f1f5f9',
    fg: '#475569',
    description: '',
  }
}

export function nextMembershipType(current: string | null | undefined): MembershipType {
  // Ciclu: core -> occasional -> punctual -> core
  switch (current) {
    case 'core':
      return 'occasional'
    case 'occasional':
      return 'punctual'
    case 'punctual':
      return 'core'
    default:
      return 'core'
  }
}
