import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Determines the top scorer for a team and settles every `team_scorer`
 * special bet for that team: awards `pts_team_scorer` to bets that picked
 * the winner (0 otherwise) and locks them. Used both by the manual admin
 * action and by sync/grupos when a team is eliminated.
 */
export async function apurarArtilheiroSelecao(
  supabase: SupabaseClient,
  teamId: string
): Promise<{ winner: string | null; winnerId: string | null; betsCalculated: number }> {
  const { data: topPlayer } = await supabase
    .from('players')
    .select('id, name, goals_in_tournament')
    .eq('team_id', teamId)
    .order('goals_in_tournament', { ascending: false })
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle()

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
    const points = topPlayer && bet.player_id === topPlayer.id ? ptsTeamScorer : 0
    const { error } = await supabase
      .from('special_bets')
      .update({ points_earned: points, is_locked: true })
      .eq('id', bet.id)
    if (!error) betsCalculated++
  }

  return {
    winner: topPlayer?.name ?? null,
    winnerId: topPlayer?.id ?? null,
    betsCalculated,
  }
}
