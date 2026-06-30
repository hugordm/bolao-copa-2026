import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Determines the top scorer(s) for a team and settles every `team_scorer`
 * special bet for that team: awards `pts_team_scorer` to bets that picked
 * any of the tied top scorers (0 otherwise) and locks them. Used both by
 * the manual admin action and by sync/grupos when a team is eliminated.
 *
 * Only settles bets once the team is actually eliminated — while a team is
 * still in the tournament its top scorer can keep changing, so bets must
 * stay unlocked with points_earned at 0 (shown as "Pendente" in the UI).
 *
 * In case of a tie (multiple players with the same goals), any bet that
 * picked one of the tied players counts as a correct guess.
 */
export async function apurarArtilheiroSelecao(
  supabase: SupabaseClient,
  teamId: string
): Promise<{ winner: string | null; winnerId: string | null; betsCalculated: number }> {
  const { data: team } = await supabase
    .from('teams')
    .select('is_eliminated')
    .eq('id', teamId)
    .single()

  if (!team?.is_eliminated) {
    return { winner: null, winnerId: null, betsCalculated: 0 }
  }

  const { data: players } = await supabase
    .from('players')
    .select('id, name, goals_in_tournament')
    .eq('team_id', teamId)
    .order('goals_in_tournament', { ascending: false })

  const maxGoals = players?.[0]?.goals_in_tournament ?? 0
  const topPlayers = maxGoals > 0
    ? (players ?? []).filter(p => p.goals_in_tournament === maxGoals)
    : []
  const topPlayerIds = new Set(topPlayers.map(p => p.id))

  const { data: config } = await supabase
    .from('score_config')
    .select('pts_team_scorer')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const ptsTeamScorer = config?.pts_team_scorer ?? 0

  const { data: bets } = await supabase
    .from('special_bets')
    .select('id, player_id')
    .eq('bet_type', 'team_scorer')
    .eq('team_id', teamId)

  let betsCalculated = 0
  for (const bet of bets ?? []) {
    const points = bet.player_id && topPlayerIds.has(bet.player_id) ? ptsTeamScorer : 0
    const { error } = await supabase
      .from('special_bets')
      .update({ points_earned: points, is_locked: true })
      .eq('id', bet.id)
    if (!error) betsCalculated++
  }

  const winner = topPlayers.length > 0 ? topPlayers.map(p => p.name).join(' / ') : null
  const winnerId = topPlayers.length === 1 ? topPlayers[0].id : null

  return { winner, winnerId, betsCalculated }
}
