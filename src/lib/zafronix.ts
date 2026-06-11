import type { Match, Player } from '@/lib/types'

const BASE_URL = process.env.ZAFRONIX_API_URL ?? 'https://api.zafronix.com/fifa/worldcup/v1'

/** World Cup 2026 is the only tournament this app cares about. */
export const TOURNAMENT_YEAR = 2026

/** Calls the Zafronix World Cup API. Logs and throws with the API's own error message on failure. */
export async function fetchZafronix<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const apiKey = process.env.ZAFRONIX_API_KEY
  if (!apiKey) throw new Error('ZAFRONIX_API_KEY not configured')

  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey },
    cache: 'no-store',
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const detail =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText

    console.error(`[zafronix] ${path}`, JSON.stringify({ params, status: res.status, body: data }))
    throw new Error(`Zafronix API ${path}: ${res.status} ${detail}`)
  }

  return data as T
}

/** Returns the date (YYYY-MM-DD) for the given instant in the America/Sao_Paulo timezone. */
export function dateBrasilia(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Zafronix uses different country names in `/teams` vs `/matches` for these 8 teams
 *  (e.g. /teams says "Czech Republic", /matches says "Czechia"). Maps the `/matches`
 *  naming to the `/teams` naming so matches can be joined to our `teams.name`. */
const MATCH_TEAM_NAME_ALIASES: Record<string, string> = {
  Czechia: 'Czech Republic',
  'Korea Republic': 'South Korea',
  "Côte d'Ivoire": 'Ivory Coast',
  Türkiye: 'Turkey',
  USA: 'United States',
  'IR Iran': 'Iran',
  'Cabo Verde': 'Cape Verde',
  'Congo DR': 'DR Congo',
}

/** Normalizes a team name from `/matches` to the canonical name used in `/teams`. */
export function normalizeTeamName(name: string): string {
  return MATCH_TEAM_NAME_ALIASES[name] ?? name
}

/** Maps a Zafronix `stageNormalized` value (group_a..group_l, round_of_32, round_of_16,
 *  quarter_final, semi_final, final, third_place) to our `matches.phase` enum. */
export function mapZafronixStage(stage: string): Match['phase'] {
  const s = stage.toLowerCase()
  if (s.startsWith('group')) return 'groups'
  switch (s) {
    case 'round_of_32':
    case 'r32':
      return 'r32'
    case 'round_of_16':
    case 'r16':
      return 'r16'
    case 'quarter_final':
    case 'qf':
      return 'qf'
    case 'semi_final':
    case 'sf':
      return 'sf'
    default:
      // 'final' and 'third_place' (no dedicated value in our phase enum).
      return 'final'
  }
}

/** Maps a Zafronix squad position (GK/DF/MF/FW) to our `players.position` enum. */
export function mapZafronixPosition(position: string | null | undefined): Player['position'] {
  switch ((position ?? '').toUpperCase()) {
    case 'GK':
      return 'GK'
    case 'DF':
      return 'DEF'
    case 'MF':
      return 'MID'
    default:
      return 'FWD'
  }
}

export type ZafronixSquadPlayer = {
  jersey: number
  name: string
  position: string
  born: string | null
  ageAtTournament: number | null
  club: { name: string; country: string } | null
  goals: number
  captain: boolean
}

export type ZafronixGroupStage = {
  group: string | null
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
  position: number | null
}

export type ZafronixTeam = {
  name: string
  code: string
  iso: string
  confederation: string
  groupStage: ZafronixGroupStage
  squad: ZafronixSquadPlayer[]
  flag: { flagUrl: string | null } | null
}

export type ZafronixMatch = {
  id: string
  matchNo: number
  date: string
  kickoff: string
  kickoffUtc: string
  stage: string
  stageNormalized: string
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
  result: string | null
}

export type ZafronixStandingEntry = {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  position: number | null
  advanced?: boolean
}

export type ZafronixStandings = {
  year: number
  groups: Record<string, ZafronixStandingEntry[]>
}

/** Fetches all 48 teams for the 2026 World Cup, including full squads (with goals) and group standings. */
export async function fetchTeams(): Promise<ZafronixTeam[]> {
  return fetchZafronix<ZafronixTeam[]>('/teams', { tournament: TOURNAMENT_YEAR })
}

/** Fetches all 104 matches for the 2026 World Cup. */
export async function fetchMatches(): Promise<ZafronixMatch[]> {
  const data = await fetchZafronix<{ year: number; count: number; data: ZafronixMatch[] }>('/matches', {
    year: TOURNAMENT_YEAR,
  })
  return data.data
}

/** Fetches group standings (with FIFA tiebreakers and qualification status) for the 2026 World Cup. */
export async function fetchStandings(): Promise<ZafronixStandings> {
  return fetchZafronix<ZafronixStandings>('/standings', { year: TOURNAMENT_YEAR })
}
