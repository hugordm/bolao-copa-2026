import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchTeams } from '@/lib/zafronix'

/** Updates `players.goals_in_tournament` from each team's squad in Zafronix. */
export async function syncArtilharia(supabase: SupabaseClient): Promise<{ updated: number }> {
  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, code')
  if (teamsError) throw new Error(teamsError.message)

  const teamByCode = new Map((teams ?? []).map(t => [t.code, t.id as string]))
  if (teamByCode.size === 0) return { updated: 0 }

  const players: { id: string; team_id: string; name: string; goals_in_tournament: number }[] = []
  const PAGE_SIZE = 1000
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('players')
      .select('id, team_id, name, goals_in_tournament')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    players.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  const playerByKey = new Map(players.map(p => [`${p.team_id}:${p.name}`, p]))

  const zafronixTeams = await fetchTeams()

  let updated = 0

  for (const zt of zafronixTeams) {
    const teamId = teamByCode.get(zt.code)
    if (!teamId) continue

    for (const p of zt.squad) {
      const existing = playerByKey.get(`${teamId}:${p.name}`)
      if (!existing || p.goals <= existing.goals_in_tournament) continue

      // Only overwrite if the API value is greater, so manually entered
      // goal counts are never reduced by a stale/zero value from the API.
      const { error } = await supabase
        .from('players')
        .update({ goals_in_tournament: p.goals })
        .eq('id', existing.id)
        .lt('goals_in_tournament', p.goals)
      if (error) continue
      updated++
    }
  }

  return { updated }
}
