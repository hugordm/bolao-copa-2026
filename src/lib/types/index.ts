export type User = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

export type Team = {
  id: string
  name: string
  code: string
  flag_url: string | null
  group_name: string | null
  is_eliminated: boolean
  external_id: string | null
}

export type Player = {
  id: string
  team_id: string
  name: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  goals_in_tournament: number
  is_active: boolean
  team?: Team
}

export type Match = {
  id: string
  home_team_id: string
  away_team_id: string
  phase: 'groups' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  group_name: string | null
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  is_finished: boolean
  external_id: string | null
  resultado_tipo: 'normal' | 'prorrogacao' | 'penaltis' | null
  vencedor_penaltis_id: string | null
  home_team?: Team
  away_team?: Team
}

export type Bet = {
  id: string
  user_id: string
  match_id: string
  home_score_bet: number
  away_score_bet: number
  points_earned: number
  edit_count: number
  submitted_at: string
  match?: Match
}

export type GroupOrderBet = {
  id: string
  user_id: string
  group_name: string
  team_1st_id: string
  team_2nd_id: string
  team_3rd_id: string
  team_4th_id: string
  points_earned: number
  edit_count: number
}

export type SpecialBet = {
  id: string
  user_id: string
  bet_type: 'champion' | 'top_scorer' | 'team_scorer'
  team_id: string | null
  player_id: string | null
  points_earned: number
  edit_count: number
  is_locked: boolean
}

export type ScoreConfig = {
  id: string
  pts_exact_score: number
  pts_correct_result: number
  pts_group_1st: number
  pts_group_order_partial: number
  pts_group_order_exact: number
  pts_champion: number
  pts_top_scorer: number
  pts_team_scorer: number
  last_sync: string | null
}

export type GroupStanding = {
  id: string
  team_id: string
  group_name: string
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  is_best_third: boolean
  updated_at: string
  team?: Team
}

export type RankingUser = {
  id: string
  name: string
  avatar_url: string | null
  total_points: number
  position: number
}
