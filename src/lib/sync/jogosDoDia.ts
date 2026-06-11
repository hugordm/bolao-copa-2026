import type { SupabaseClient } from '@supabase/supabase-js'
import type { Match } from '@/lib/types'
import { syncJogos } from '@/lib/sync/jogos'

const CACHE_MS = 5 * 60 * 1000
// World Cup matches (incl. extra time/penalties) wrap up well within 2h30.
const LIVE_WINDOW_MS = 150 * 60 * 1000

export type JogoDoDia = {
  id: string
  home_team: { name: string; logo: string | null }
  away_team: { name: string; logo: string | null }
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  is_finished: boolean
  is_live: boolean
  phase: Match['phase']
  group: string | null
}

type TeamRef = { name: string; flag_url: string | null } | null

/** Fetches matches for the given Brasília date (YYYY-MM-DD), syncing from Zafronix if the cache is stale. */
export async function getJogosDoDia(supabase: SupabaseClient, date: string): Promise<JogoDoDia[]> {
  const { data: config } = await supabase
    .from('score_config')
    .select('id, last_sync')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const stale = !config?.last_sync || Date.now() - new Date(config.last_sync).getTime() > CACHE_MS

  if (stale) {
    try {
      await syncJogos(supabase)
      if (config?.id) {
        await supabase
          .from('score_config')
          .update({ last_sync: new Date().toISOString() })
          .eq('id', config.id)
      }
    } catch (err) {
      console.error('getJogosDoDia sync error:', err)
    }
  }

  const dayStart = `${date}T00:00:00-03:00`
  const dayEnd = `${date}T23:59:59-03:00`

  const { data: matches, error } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, home_score, away_score, is_finished, phase, group_name, home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url)'
    )
    .gte('kickoff_at', dayStart)
    .lte('kickoff_at', dayEnd)
    .order('kickoff_at', { ascending: true })

  if (error) throw new Error(error.message)

  const now = Date.now()

  return (matches ?? []).map(m => {
    const kickoff = new Date(m.kickoff_at).getTime()
    const isLive = !m.is_finished && now >= kickoff && now - kickoff < LIVE_WINDOW_MS

    const home = (Array.isArray(m.home_team) ? m.home_team[0] : m.home_team) as TeamRef
    const away = (Array.isArray(m.away_team) ? m.away_team[0] : m.away_team) as TeamRef

    return {
      id: m.id,
      home_team: { name: home?.name ?? '', logo: home?.flag_url ?? null },
      away_team: { name: away?.name ?? '', logo: away?.flag_url ?? null },
      kickoff_at: m.kickoff_at,
      home_score: m.home_score,
      away_score: m.away_score,
      is_finished: m.is_finished,
      is_live: isLive,
      phase: m.phase,
      group: m.group_name,
    }
  })
}
