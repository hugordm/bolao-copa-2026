import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMatches, mapZafronixStage, normalizeTeamName } from '@/lib/zafronix'

/** Syncs all 104 World Cup matches from Zafronix into the `matches` table. */
export async function syncJogos(supabase: SupabaseClient): Promise<{ updated: number }> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, group_name')

  if (teamsError) throw new Error(teamsError.message)
  if (!teams || teams.length === 0) return { updated: 0 }

  const teamByName = new Map(
    teams.map(t => [t.name, { id: t.id, group_name: t.group_name as string | null }])
  )

  const matches = await fetchMatches()

  const { data: existing, error: existingError } = await supabase
    .from('matches')
    .select('external_id, manually_edited')

  if (existingError) throw new Error(existingError.message)

  const manuallyEditedIds = new Set(
    (existing ?? []).filter(m => m.manually_edited).map(m => m.external_id)
  )

  const metaRows = []
  const scoreRows = []
  for (const m of matches) {
    const home = m.homeTeam ? teamByName.get(normalizeTeamName(m.homeTeam)) : undefined
    const away = m.awayTeam ? teamByName.get(normalizeTeamName(m.awayTeam)) : undefined
    if (!home || !away) continue

    const phase = mapZafronixStage(m.stageNormalized ?? m.stage)
    const groupMatch = /^group_([a-l])$/i.exec(m.stage)
    const groupName = groupMatch
      ? groupMatch[1].toUpperCase()
      : phase === 'groups'
        ? (home.group_name ?? away.group_name)
        : null

    metaRows.push({
      external_id: m.id,
      home_team_id: home.id,
      away_team_id: away.id,
      phase,
      group_name: groupName,
      kickoff_at: m.kickoffUtc,
    })

    // Matches the admin manually corrected keep their placar — never overwritten by sync.
    if (!manuallyEditedIds.has(m.id)) {
      scoreRows.push({
        external_id: m.id,
        home_score: m.homeScore,
        away_score: m.awayScore,
        is_finished: m.result !== null,
      })
    }
  }

  if (metaRows.length === 0) return { updated: 0 }

  const { error } = await supabase.from('matches').upsert(metaRows, { onConflict: 'external_id' })
  if (error) throw new Error(error.message)

  if (scoreRows.length > 0) {
    const { error: scoreError } = await supabase
      .from('matches')
      .upsert(scoreRows, { onConflict: 'external_id' })
    if (scoreError) throw new Error(scoreError.message)
  }

  return { updated: metaRows.length }
}
