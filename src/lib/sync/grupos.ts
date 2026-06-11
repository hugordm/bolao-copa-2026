import type { SupabaseClient } from '@supabase/supabase-js'
import { apurarArtilheiroSelecao } from '@/lib/artilheiro'
import { fetchStandings, normalizeTeamName } from '@/lib/zafronix'

/** Marks teams eliminated from group stage and apura their team-scorer bets. */
export async function syncGrupos(
  supabase: SupabaseClient
): Promise<{ groups_updated: number; teams_eliminated: number }> {
  const standings = await fetchStandings()

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, is_eliminated')
  if (teamsError) throw new Error(teamsError.message)

  const teamByName = new Map((teams ?? []).map(t => [t.name, t]))

  let groupsUpdated = 0
  let teamsEliminated = 0

  for (const entries of Object.values(standings.groups)) {
    // Group stage complete once every team has played all its round-robin matches.
    const groupComplete = entries.every(e => e.played >= entries.length - 1)
    if (!groupComplete) continue

    groupsUpdated++

    for (const entry of entries) {
      const team = teamByName.get(normalizeTeamName(entry.team))
      if (!team || team.is_eliminated) continue

      if (!entry.advanced) {
        await supabase.from('teams').update({ is_eliminated: true }).eq('id', team.id)
        await apurarArtilheiroSelecao(supabase, team.id)
        teamsEliminated++
      }
    }
  }

  return { groups_updated: groupsUpdated, teams_eliminated: teamsEliminated }
}
