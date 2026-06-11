import type { SupabaseClient } from '@supabase/supabase-js'

export function resultado(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

export function calcularPontosAposta(
  betHome: number,
  betAway: number,
  matchHome: number,
  matchAway: number,
  config: { pts_exact_score: number; pts_correct_result: number }
): number {
  if (betHome === matchHome && betAway === matchAway) {
    return config.pts_exact_score
  }
  if (resultado(betHome, betAway) === resultado(matchHome, matchAway)) {
    return config.pts_correct_result
  }
  return 0
}

/**
 * Recalculates `points_earned` for every bet on a finished match.
 * Returns the number of bets updated (0 if the match isn't finished yet).
 */
export async function recalcularPontosDoJogo(
  supabase: SupabaseClient,
  matchId: string
): Promise<number> {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('home_score, away_score, is_finished')
    .eq('id', matchId)
    .single()

  if (
    matchError ||
    !match ||
    !match.is_finished ||
    match.home_score == null ||
    match.away_score == null
  ) {
    return 0
  }

  const { data: config, error: configError } = await supabase
    .from('score_config')
    .select('pts_exact_score, pts_correct_result')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (configError || !config) return 0

  const { data: bets, error: betsError } = await supabase
    .from('bets')
    .select('id, home_score_bet, away_score_bet')
    .eq('match_id', matchId)

  if (betsError || !bets) return 0

  let updated = 0
  for (const bet of bets) {
    const points = calcularPontosAposta(
      bet.home_score_bet,
      bet.away_score_bet,
      match.home_score,
      match.away_score,
      config
    )
    const { error } = await supabase.from('bets').update({ points_earned: points }).eq('id', bet.id)
    if (!error) updated++
  }

  return updated
}
