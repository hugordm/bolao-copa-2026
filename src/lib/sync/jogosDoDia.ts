import type { SupabaseClient } from '@supabase/supabase-js'
import type { Match } from '@/lib/types'
import { isMatchLive } from '@/lib/matchStatus'

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
  resultado_tipo: 'normal' | 'prorrogacao' | 'penaltis' | null
  vencedor_penaltis_nome: string | null
}

type TeamRef = { name: string; flag_url: string | null } | null

/** Fetches matches for the given Brasília date (YYYY-MM-DD) from Supabase.
 *  Reads only — Zafronix is called exclusively by the cron sync job. */
export async function getJogosDoDia(supabase: SupabaseClient, date: string): Promise<JogoDoDia[]> {
  const dayStart = `${date}T00:00:00-03:00`
  const dayEnd = `${date}T23:59:59-03:00`

  const { data: matches, error } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, home_score, away_score, is_finished, phase, group_name, resultado_tipo, vencedor_penaltis:teams!vencedor_penaltis_id(name), home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url)'
    )
    .gte('kickoff_at', dayStart)
    .lte('kickoff_at', dayEnd)
    .order('kickoff_at', { ascending: true })

  if (error) throw new Error(error.message)

  const now = Date.now()

  return (matches ?? []).map(m => {
    const isLive = isMatchLive(m.kickoff_at, m.is_finished, now)

    const home = (Array.isArray(m.home_team) ? m.home_team[0] : m.home_team) as TeamRef
    const away = (Array.isArray(m.away_team) ? m.away_team[0] : m.away_team) as TeamRef
    const vencedor = (Array.isArray(m.vencedor_penaltis) ? m.vencedor_penaltis[0] : m.vencedor_penaltis) as TeamRef

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
      resultado_tipo: (m.resultado_tipo as JogoDoDia['resultado_tipo']) ?? null,
      vencedor_penaltis_nome: vencedor?.name ?? null,
    }
  })
}
