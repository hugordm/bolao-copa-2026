/**
 * Shared metadata for a team's final tournament status (`teams.final_position`).
 * `null`/absent means the team is still active. Used by the admin panel to pick
 * a status and by the public standings to render a badge.
 */

export type FinalPosition = 'champion' | 'runner_up' | 'third' | 'fourth' | 'eliminated'

// The value written to `teams.final_position`; 'active' is the UI-only reset
// state that maps to a null column value.
export type FinalStatus = 'active' | FinalPosition

type StatusMeta = {
  status: FinalStatus
  label: string
  emoji: string
  /** Short badge text shown in the standings. */
  badge: string
  /** Tailwind classes for the badge (bg + text + border). */
  badgeClass: string
}

export const FINAL_STATUS_META: Record<FinalStatus, StatusMeta> = {
  active: {
    status: 'active',
    label: 'Ativa',
    emoji: '✅',
    badge: '',
    badgeClass: '',
  },
  champion: {
    status: 'champion',
    label: 'Campeã',
    emoji: '🥇',
    badge: '🥇 Campeã',
    badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  },
  runner_up: {
    status: 'runner_up',
    label: 'Vice-campeã',
    emoji: '🥈',
    badge: '🥈 Vice',
    badgeClass: 'bg-zinc-300/15 text-zinc-200 border-zinc-300/30',
  },
  third: {
    status: 'third',
    label: '3º lugar',
    emoji: '🥉',
    badge: '🥉 3º lugar',
    badgeClass: 'bg-amber-700/20 text-amber-500 border-amber-700/40',
  },
  fourth: {
    status: 'fourth',
    label: '4º lugar',
    emoji: '4️⃣',
    badge: '4️⃣ 4º lugar',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  eliminated: {
    status: 'eliminated',
    label: 'Eliminada',
    emoji: '❌',
    badge: '✗ Eliminada',
    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
}

// Order the options appear in the admin status picker.
export const FINAL_STATUS_ORDER: FinalStatus[] = [
  'active',
  'eliminated',
  'champion',
  'runner_up',
  'third',
  'fourth',
]

export function finalStatusOf(
  team: { final_position?: string | null; is_eliminated?: boolean }
): FinalStatus {
  const fp = team.final_position
  if (fp && fp in FINAL_STATUS_META && fp !== 'active') return fp as FinalStatus
  // Fall back to the legacy elimination flag for teams marked before
  // `final_position` existed.
  if (team.is_eliminated) return 'eliminated'
  return 'active'
}
