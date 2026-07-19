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

/**
 * Recalculates `points_earned` for every bet on every finished match.
 * Used by the admin "Recalcular pontos" action to fix bets whose points were
 * never computed (e.g. matches finished before the recalculation ran).
 */
export async function recalcularTodosPontos(
  supabase: SupabaseClient
): Promise<{ matches: number; updatedBets: number }> {
  const { data: matches, error } = await supabase.from('matches').select('id').eq('is_finished', true)

  if (error || !matches) return { matches: 0, updatedBets: 0 }

  let updatedBets = 0
  for (const match of matches) {
    updatedBets += await recalcularPontosDoJogo(supabase, match.id)
  }

  return { matches: matches.length, updatedBets }
}

/**
 * Determines the tournament top scorer(s) and settles every `top_scorer`
 * special bet: awards `pts_top_scorer` to bets that picked any of the tied top
 * scorers (0 otherwise) and locks them.
 *
 * Unlike `apurarArtilheiroSelecao` (which is per team), this looks at ALL
 * players in the tournament and picks the one(s) with the most
 * `goals_in_tournament`. It should be run once the tournament is over (e.g. when
 * the champion is crowned), since the top scorer can keep changing while any
 * match is still to be played.
 *
 * In case of a tie (multiple players with the same top goal count), any bet that
 * picked one of the tied players counts as a correct guess.
 */
export async function apurarArtilheiroCopa(
  supabase: SupabaseClient
): Promise<{ winner: string | null; winnerId: string | null; betsCalculated: number }> {
  const { data: players } = await supabase
    .from('players')
    .select('id, name, goals_in_tournament')
    .order('goals_in_tournament', { ascending: false })

  const maxGoals = players?.[0]?.goals_in_tournament ?? 0
  const topPlayers = maxGoals > 0
    ? (players ?? []).filter(p => p.goals_in_tournament === maxGoals)
    : []
  const topPlayerIds = new Set(topPlayers.map(p => p.id))

  const { data: config } = await supabase
    .from('score_config')
    .select('pts_top_scorer')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const ptsTopScorer = config?.pts_top_scorer ?? 0

  const { data: bets } = await supabase
    .from('special_bets')
    .select('id, player_id')
    .eq('bet_type', 'top_scorer')

  let betsCalculated = 0
  for (const bet of bets ?? []) {
    const points = bet.player_id && topPlayerIds.has(bet.player_id) ? ptsTopScorer : 0
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

type StandingRow = {
  team_id: string
  group_name: string
  goals_for: number
  goal_difference: number
  points: number
  is_best_third: boolean
}

/** Sorts standings by points, then goal difference, then goals for (best first). */
function compararStandings(a: StandingRow, b: StandingRow): number {
  return (
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for
  )
}

export type ThirdPlaceCandidate = {
  team_id: string
  goals_for: number
  goal_difference: number
  points: number
  is_best_third: boolean
}

/**
 * Picks the 8 third-placed teams that advance to the round of 32.
 * Honors manual `is_best_third` overrides set by the admin (used to break total
 * ties); falls back to automatic ranking by points -> goal difference -> goals for
 * when none (or not exactly 8) are marked.
 */
export function selecionarMelhoresTerceiros(thirdPlaced: ThirdPlaceCandidate[]): Set<string> {
  const manual = thirdPlaced.filter(t => t.is_best_third)
  if (manual.length === 8) {
    return new Set(manual.map(t => t.team_id))
  }
  return new Set(
    [...thirdPlaced]
      .sort((a, b) =>
        b.points - a.points ||
        b.goal_difference - a.goal_difference ||
        b.goals_for - a.goals_for
      )
      .slice(0, 8)
      .map(t => t.team_id)
  )
}

/**
 * Recalculates `group_standings.position` (1-4 within each group, by points/SG/GF
 * tiebreakers) and `group_order_bets.points_earned` for every group-order bet.
 *
 * Scoring is tiered (highest tier wins, not cumulative):
 * - Got the 1st place team right: pts_group_1st
 * - Got 1st and 2nd in the exact order: pts_group_order_partial
 * - Got the exact order from 1st to 4th: pts_group_order_exact
 *
 * For the 3rd/4th positions, the order between them only needs to match exactly
 * when the actual 3rd-placed team is one of the 8 best third-placed teams overall
 * (i.e. it qualifies for the round of 32). Otherwise both 3rd and 4th are
 * eliminated and are treated as interchangeable for the "exact order" tier.
 */
export async function calcularPontosGrupos(
  supabase: SupabaseClient
): Promise<{ updatedStandings: number; updatedBets: number }> {
  const { data: standings, error: standingsError } = await supabase
    .from('group_standings')
    .select('team_id, group_name, goals_for, goal_difference, points, is_best_third')

  if (standingsError || !standings || standings.length === 0) {
    return { updatedStandings: 0, updatedBets: 0 }
  }

  const orderByGroup = new Map<string, string[]>()
  const positionByTeam = new Map<string, number>()

  const byGroup = new Map<string, StandingRow[]>()
  for (const s of standings as StandingRow[]) {
    const list = byGroup.get(s.group_name) ?? []
    list.push(s)
    byGroup.set(s.group_name, list)
  }

  for (const [groupName, teams] of byGroup) {
    const sorted = [...teams].sort(compararStandings)
    orderByGroup.set(groupName, sorted.map(t => t.team_id))
    sorted.forEach((t, idx) => positionByTeam.set(t.team_id, idx + 1))
  }

  let updatedStandings = 0
  await Promise.all(
    Array.from(positionByTeam.entries()).map(async ([teamId, position]) => {
      const { error } = await supabase
        .from('group_standings')
        .update({ position })
        .eq('team_id', teamId)
      if (!error) updatedStandings++
    })
  )

  const thirdPlaced = (standings as StandingRow[]).filter(s => positionByTeam.get(s.team_id) === 3)
  const bestThirds = selecionarMelhoresTerceiros(thirdPlaced)

  const { data: config, error: configError } = await supabase
    .from('score_config')
    .select('pts_group_1st, pts_group_order_partial, pts_group_order_exact')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (configError || !config) return { updatedStandings, updatedBets: 0 }

  const { data: bets, error: betsError } = await supabase
    .from('group_order_bets')
    .select('id, group_name, team_1st_id, team_2nd_id, team_3rd_id, team_4th_id')

  if (betsError || !bets) return { updatedStandings, updatedBets: 0 }

  let updatedBets = 0
  for (const bet of bets) {
    const actual = orderByGroup.get(bet.group_name)
    if (!actual || actual.length < 4) continue

    const [a1, a2, a3, a4] = actual
    let points = 0

    if (bet.team_1st_id === a1 && bet.team_2nd_id === a2) {
      const ordemExata =
        (bet.team_3rd_id === a3 && bet.team_4th_id === a4) ||
        (!bestThirds.has(a3) && bet.team_3rd_id === a4 && bet.team_4th_id === a3)

      points = ordemExata ? config.pts_group_order_exact : config.pts_group_order_partial
    } else if (bet.team_1st_id === a1) {
      points = config.pts_group_1st
    }

    const { error } = await supabase
      .from('group_order_bets')
      .update({ points_earned: points })
      .eq('id', bet.id)
    if (!error) updatedBets++
  }

  return { updatedStandings, updatedBets }
}
