'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resultado } from '@/lib/scoring'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Time = { name: string; flag_url: string | null }

type Phase = 'groups' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'

type Match = {
  id: string
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  is_finished: boolean
  phase: Phase
  group_name: string | null
  home_team: Time
  away_team: Time
}

type Bet = {
  id: string
  match_id: string
  home_score_bet: number
  away_score_bet: number
  points_earned: number | null
  edit_count: number
}

type Team = {
  id: string
  name: string
  flag_url: string | null
  group_name: string | null
  is_eliminated: boolean
}

type GroupOrderBet = {
  id: string
  group_name: string
  team_1st_id: string
  team_2nd_id: string
  team_3rd_id: string
  team_4th_id: string
  points_earned: number | null
  edit_count: number
}

type Player = {
  id: string
  name: string
  team_id: string
  goals_in_tournament: number
}

type SpecialBetType = 'champion' | 'top_scorer' | 'team_scorer'

type SpecialBet = {
  id: string
  bet_type: SpecialBetType
  team_id: string | null
  player_id: string | null
  points_earned: number | null
  edit_count: number
  is_locked: boolean
}

type ScoreConfig = {
  pts_exact_score: number
  pts_correct_result: number
  pts_group_1st: number
  pts_group_order_partial: number
  pts_group_order_exact: number
  pts_champion: number
  pts_top_scorer: number
  pts_team_scorer: number
}

const DEFAULT_CONFIG: ScoreConfig = {
  pts_exact_score: 3,
  pts_correct_result: 1,
  pts_group_1st: 5,
  pts_group_order_partial: 1,
  pts_group_order_exact: 3,
  pts_champion: 10,
  pts_top_scorer: 8,
  pts_team_scorer: 5,
}

const PHASE_LABELS: Record<Phase, string> = {
  groups: 'Grupos',
  r32: '16-avos',
  r16: 'Oitavas',
  qf: 'Quartas',
  sf: 'Semis',
  final: 'Final',
}

const PHASE_ORDER: Phase[] = ['groups', 'r32', 'r16', 'qf', 'sf', 'final']

const STATUS_STYLES = {
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  zinc: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
} as const

type StatusColor = keyof typeof STATUS_STYLES

function StatusBadge({ color, children }: { color: StatusColor; children: React.ReactNode }) {
  return <Badge className={STATUS_STYLES[color]}>{children}</Badge>
}

function singleOrFirst<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function Flag({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) return <span className="text-lg">🏳️</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-5 rounded-full object-cover" />
}

// ---------------------------------------------------------------------------
// Tab 1 — Placares
// ---------------------------------------------------------------------------

type PlacarStatus = 'exato' | 'certo' | 'errado' | 'pendente' | 'sem_palpite'

const PLACAR_STATUS_INFO: Record<PlacarStatus, { color: StatusColor; label: string }> = {
  exato: { color: 'emerald', label: '🎯 Placar exato!' },
  certo: { color: 'blue', label: '✅ Resultado certo' },
  errado: { color: 'red', label: '❌ Errou' },
  pendente: { color: 'zinc', label: '⏳ Aguardando resultado' },
  sem_palpite: { color: 'zinc', label: '🔓 Sem palpite' },
}

function getPlacarStatus(bet: Bet | undefined, match: Match): PlacarStatus {
  if (!bet) return 'sem_palpite'
  if (!match.is_finished || match.home_score == null || match.away_score == null) return 'pendente'
  if (bet.home_score_bet === match.home_score && bet.away_score_bet === match.away_score) return 'exato'
  if (resultado(bet.home_score_bet, bet.away_score_bet) === resultado(match.home_score, match.away_score)) return 'certo'
  return 'errado'
}

function PlacarCard({ match, bet }: { match: Match; bet: Bet | undefined }) {
  const status = getPlacarStatus(bet, match)
  const info = PLACAR_STATUS_INFO[status]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 mb-1">
        {PHASE_LABELS[match.phase]}{match.group_name ? ` · Gr.${match.group_name}` : ''} · {formatDateTime(match.kickoff_at)}
      </p>
      <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <Flag url={match.home_team.flag_url} alt="" />
          {match.home_team.name}
        </span>
        <span className="text-zinc-500">×</span>
        <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <Flag url={match.away_team.flag_url} alt="" />
          {match.away_team.name}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Palpite enviado</p>
          <p className="font-bold text-zinc-200">
            {bet ? `${bet.home_score_bet} × ${bet.away_score_bet}` : '—'}
          </p>
        </div>
        {match.is_finished && match.home_score != null && match.away_score != null && (
          <div>
            <p className="text-xs text-zinc-500">Resultado real</p>
            <p className="font-bold text-zinc-200">{match.home_score} × {match.away_score}</p>
          </div>
        )}
        {bet && match.is_finished && (
          <div>
            <p className="text-xs text-zinc-500">Pontos</p>
            <p className="font-bold text-emerald-400">+{bet.points_earned ?? 0} pts</p>
          </div>
        )}
      </div>

      <StatusBadge color={info.color}>{info.label}</StatusBadge>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2 — Grupos
// ---------------------------------------------------------------------------

type GroupStatus = 'exato' | 'parcial' | 'errado' | 'pendente' | 'sem_palpite'

const GROUP_STATUS_INFO: Record<GroupStatus, { color: StatusColor; label: string }> = {
  exato: { color: 'emerald', label: '✅ Ordem exata' },
  parcial: { color: 'blue', label: '✅ Parcial' },
  errado: { color: 'red', label: '❌ Errou' },
  pendente: { color: 'zinc', label: '⏳ Pendente' },
  sem_palpite: { color: 'zinc', label: '🔓 Sem palpite' },
}

function getGroupStatus(bet: GroupOrderBet | undefined, finished: boolean, config: ScoreConfig): GroupStatus {
  if (!bet) return 'sem_palpite'
  if (!finished) return 'pendente'
  const pts = bet.points_earned ?? 0
  if (config.pts_group_order_exact > 0 && pts >= config.pts_group_order_exact) return 'exato'
  if (pts > 0) return 'parcial'
  return 'errado'
}

function GroupCard({
  groupName,
  bet,
  teamsById,
  finished,
  config,
}: {
  groupName: string
  bet: GroupOrderBet | undefined
  teamsById: Map<string, Team>
  finished: boolean
  config: ScoreConfig
}) {
  const status = getGroupStatus(bet, finished, config)
  const info = GROUP_STATUS_INFO[status]
  const order = bet ? [bet.team_1st_id, bet.team_2nd_id, bet.team_3rd_id, bet.team_4th_id] : []

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-zinc-50">Grupo {groupName}</h3>
        <StatusBadge color={info.color}>{info.label}</StatusBadge>
      </div>

      {bet ? (
        <div className="space-y-1.5 mb-3">
          {order.map((teamId, idx) => {
            const team = teamsById.get(teamId)
            return (
              <div key={teamId} className="flex items-center gap-2">
                <span className="w-5 text-xs text-zinc-600 font-bold">{idx + 1}º</span>
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
                  <Flag url={team?.flag_url} alt="" />
                  <span className="text-sm font-medium text-zinc-200">{team?.name ?? '?'}</span>
                  {team?.is_eliminated && (
                    <span className="ml-auto rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/30">
                      Eliminada
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mb-3 text-sm text-zinc-500">Você ainda não palpitou neste grupo</p>
      )}

      {bet && finished && (
        <p className="text-sm text-zinc-400">
          Pontos ganhos: <span className="font-bold text-emerald-400">{bet.points_earned ?? 0} pts</span>
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3 — Especiais
// ---------------------------------------------------------------------------

type EspecialStatus = 'acertou' | 'errou' | 'pendente' | 'sem_palpite'

const ESPECIAL_STATUS_INFO: Record<EspecialStatus, { color: StatusColor; label: string }> = {
  acertou: { color: 'emerald', label: '✅ Acertou' },
  errou: { color: 'red', label: '❌ Errou' },
  pendente: { color: 'zinc', label: '⏳ Pendente' },
  sem_palpite: { color: 'zinc', label: '🔓 Sem palpite' },
}

function getEspecialStatus(bet: SpecialBet | undefined): EspecialStatus {
  if (!bet) return 'sem_palpite'
  if (!bet.is_locked) return 'pendente'
  return (bet.points_earned ?? 0) > 0 ? 'acertou' : 'errou'
}

function EspecialCard({
  title,
  bet,
  children,
}: {
  title: string
  bet: SpecialBet | undefined
  children: React.ReactNode
}) {
  const status = getEspecialStatus(bet)
  const info = ESPECIAL_STATUS_INFO[status]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-50">{title}</h3>
        <StatusBadge color={info.color}>{info.label}</StatusBadge>
      </div>
      {children}
      {status === 'acertou' && (
        <p className="mt-2 text-sm font-bold text-emerald-400">+{bet?.points_earned ?? 0} pts</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4 — Resumo
// ---------------------------------------------------------------------------

type RankingEntry = { user_id: string; total_points: number }

function ResumoTab({
  bets,
  matches,
  groupBets,
  specialBets,
  ranking,
  userId,
}: {
  bets: Bet[]
  matches: Match[]
  groupBets: GroupOrderBet[]
  specialBets: SpecialBet[]
  ranking: RankingEntry[] | null
  userId: string
}) {
  const matchById = useMemo(() => new Map(matches.map(m => [m.id, m])), [matches])

  const totals = useMemo(() => {
    let exatos = 0
    let certos = 0
    let erros = 0
    for (const bet of bets) {
      const match = matchById.get(bet.match_id)
      if (!match) continue
      const status = getPlacarStatus(bet, match)
      if (status === 'exato') exatos++
      else if (status === 'certo') certos++
      else if (status === 'errado') erros++
    }
    const placarPoints = bets.reduce((s, b) => s + (b.points_earned ?? 0), 0)
    const groupPoints = groupBets.reduce((s, b) => s + (b.points_earned ?? 0), 0)
    const specialPoints = specialBets.reduce((s, b) => s + (b.points_earned ?? 0), 0)
    return {
      exatos,
      certos,
      erros,
      groupPoints,
      specialPoints,
      total: placarPoints + groupPoints + specialPoints,
    }
  }, [bets, groupBets, specialBets, matchById])

  const myRanking = useMemo(() => {
    if (!ranking) return null
    const idx = ranking.findIndex(r => r.user_id === userId)
    if (idx === -1) return null
    return { position: idx + 1, total: ranking.length }
  }, [ranking, userId])

  const chartData = useMemo(() => {
    const sums = new Map<Phase, number>()
    const phasesWithMatches = new Set<Phase>()
    for (const m of matches) phasesWithMatches.add(m.phase)
    for (const bet of bets) {
      const match = matchById.get(bet.match_id)
      if (!match) continue
      sums.set(match.phase, (sums.get(match.phase) ?? 0) + (bet.points_earned ?? 0))
    }
    return PHASE_ORDER.filter(p => phasesWithMatches.has(p)).map(p => ({
      fase: PHASE_LABELS[p],
      pontos: sums.get(p) ?? 0,
    }))
  }, [matches, bets, matchById])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">Total de pontos</p>
        <p className="text-4xl font-black text-zinc-50">{totals.total}</p>
        {myRanking && (
          <p className="mt-2 text-sm text-zinc-400">
            {myRanking.position}º de {myRanking.total} participante{myRanking.total === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{totals.exatos}</p>
          <p className="mt-1 text-xs text-zinc-500">Placares exatos</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{totals.certos}</p>
          <p className="mt-1 text-xs text-zinc-500">Resultados certos</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{totals.erros}</p>
          <p className="mt-1 text-xs text-zinc-500">Erros</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-1 text-xs text-zinc-500">Pontos em grupos</p>
          <p className="text-xl font-bold text-zinc-50">{totals.groupPoints} pts</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-1 text-xs text-zinc-500">Pontos especiais</p>
          <p className="text-xl font-bold text-zinc-50">{totals.specialPoints} pts</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Pontos por fase</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="fase" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: '#27272a' }}
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fafafa' }}
              />
              <Bar dataKey="pontos" name="Pontos" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

type FiltroPlacar = 'todos' | 'acertos' | 'erros' | 'pendentes'

export default function MeusPalpitesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [groupBets, setGroupBets] = useState<GroupOrderBet[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [specialBets, setSpecialBets] = useState<SpecialBet[]>([])
  const [config, setConfig] = useState<ScoreConfig>(DEFAULT_CONFIG)
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroPlacar, setFiltroPlacar] = useState<FiltroPlacar>('todos')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setUserId(user.id)

      const [
        { data: matchesData },
        { data: betsData },
        { data: teamsData },
        { data: groupBetsData },
        { data: playersData },
        { data: specialBetsData },
        { data: configData },
        { data: rankingData },
      ] = await Promise.all([
        supabase
          .from('matches')
          .select(
            'id, kickoff_at, home_score, away_score, is_finished, phase, group_name, home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url)'
          )
          .order('kickoff_at', { ascending: true }),
        supabase
          .from('bets')
          .select('id, match_id, home_score_bet, away_score_bet, points_earned, edit_count')
          .eq('user_id', user.id),
        supabase.from('teams').select('id, name, flag_url, group_name, is_eliminated'),
        supabase
          .from('group_order_bets')
          .select('id, group_name, team_1st_id, team_2nd_id, team_3rd_id, team_4th_id, points_earned, edit_count')
          .eq('user_id', user.id),
        supabase.from('players').select('id, name, team_id, goals_in_tournament'),
        supabase
          .from('special_bets')
          .select('id, bet_type, team_id, player_id, points_earned, edit_count, is_locked')
          .eq('user_id', user.id),
        supabase
          .from('score_config')
          .select(
            'pts_exact_score, pts_correct_result, pts_group_1st, pts_group_order_partial, pts_group_order_exact, pts_champion, pts_top_scorer, pts_team_scorer'
          )
          .order('updated_at', { ascending: false })
          .limit(1)
          .single(),
        supabase.rpc('get_ranking'),
      ])

      if (matchesData) {
        setMatches(
          matchesData.map((m): Match => ({
            id: m.id,
            kickoff_at: m.kickoff_at,
            home_score: m.home_score,
            away_score: m.away_score,
            is_finished: m.is_finished,
            phase: m.phase,
            group_name: m.group_name,
            home_team: singleOrFirst<Time>(m.home_team) ?? { name: '?', flag_url: null },
            away_team: singleOrFirst<Time>(m.away_team) ?? { name: '?', flag_url: null },
          }))
        )
      }
      if (betsData) setBets(betsData)
      if (teamsData) setTeams(teamsData)
      if (groupBetsData) setGroupBets(groupBetsData)
      if (playersData) setPlayers(playersData)
      if (specialBetsData) setSpecialBets(specialBetsData)
      if (configData) setConfig(configData)
      if (rankingData) setRanking(rankingData as RankingEntry[])
      setLoading(false)
    }
    load()
  }, [])

  const betsByMatch = useMemo(() => new Map(bets.map(b => [b.match_id, b])), [bets])
  const teamsById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])
  const playersById = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const groupBetsByName = useMemo(() => new Map(groupBets.map(b => [b.group_name, b])), [groupBets])

  const groupNames = useMemo(() => {
    const set = new Set<string>()
    for (const t of teams) if (t.group_name) set.add(t.group_name)
    return Array.from(set).sort()
  }, [teams])

  const groupFinishedMap = useMemo(() => {
    const matchesByGroup = new Map<string, Match[]>()
    for (const m of matches) {
      if (m.phase !== 'groups' || !m.group_name) continue
      const list = matchesByGroup.get(m.group_name) ?? []
      list.push(m)
      matchesByGroup.set(m.group_name, list)
    }
    const map = new Map<string, boolean>()
    for (const [name, ms] of matchesByGroup) {
      map.set(name, ms.length > 0 && ms.every(m => m.is_finished))
    }
    return map
  }, [matches])

  const matchesFiltrados = useMemo(() => {
    return matches.filter(m => {
      const bet = betsByMatch.get(m.id)
      const status = getPlacarStatus(bet, m)
      if (filtroPlacar === 'acertos') return status === 'exato' || status === 'certo'
      if (filtroPlacar === 'erros') return status === 'errado'
      if (filtroPlacar === 'pendentes') return status === 'pendente' || status === 'sem_palpite'
      return true
    })
  }, [matches, betsByMatch, filtroPlacar])

  const championBet = specialBets.find(b => b.bet_type === 'champion')
  const topScorerBet = specialBets.find(b => b.bet_type === 'top_scorer')
  const teamScorerBets = specialBets.filter(b => b.bet_type === 'team_scorer')

  const championTeam = championBet?.team_id ? teamsById.get(championBet.team_id) : undefined
  const topScorerPlayer = topScorerBet?.player_id ? playersById.get(topScorerBet.player_id) : undefined
  const topScorerTeam = topScorerPlayer ? teamsById.get(topScorerPlayer.team_id) : undefined

  const filtros: { label: string; value: FiltroPlacar }[] = [
    { label: 'Todos', value: 'todos' },
    { label: 'Acertos', value: 'acertos' },
    { label: 'Erros', value: 'erros' },
    { label: 'Pendentes', value: 'pendentes' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-6">📋 Meus Palpites</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : !userId ? (
        <p className="text-center text-zinc-500 py-12">Faça login para ver seus palpites</p>
      ) : (
        <Tabs defaultValue="placares">
          <TabsList className="w-full bg-zinc-900 border border-zinc-800 mb-6">
            <TabsTrigger value="placares" className="flex-1 data-active:bg-emerald-500 data-active:text-white">
              Placares
            </TabsTrigger>
            <TabsTrigger value="grupos" className="flex-1 data-active:bg-emerald-500 data-active:text-white">
              Grupos
            </TabsTrigger>
            <TabsTrigger value="especiais" className="flex-1 data-active:bg-emerald-500 data-active:text-white">
              Especiais
            </TabsTrigger>
            <TabsTrigger value="resumo" className="flex-1 data-active:bg-emerald-500 data-active:text-white">
              Resumo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="placares">
            <div className="flex gap-2 flex-wrap mb-4">
              {filtros.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFiltroPlacar(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    filtroPlacar === f.value
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {matchesFiltrados.length === 0 ? (
              <p className="text-center text-zinc-500 py-12">Nenhum jogo encontrado</p>
            ) : (
              <div className="space-y-3">
                {matchesFiltrados.map(m => (
                  <PlacarCard key={m.id} match={m} bet={betsByMatch.get(m.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="grupos">
            {groupNames.length === 0 ? (
              <p className="text-center text-zinc-500 py-12">Nenhum grupo encontrado</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groupNames.map(name => (
                  <GroupCard
                    key={name}
                    groupName={name}
                    bet={groupBetsByName.get(name)}
                    teamsById={teamsById}
                    finished={groupFinishedMap.get(name) ?? false}
                    config={config}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="especiais">
            <div className="space-y-4">
              <EspecialCard title="🏆 Campeão" bet={championBet}>
                {championTeam ? (
                  <div className="flex items-center gap-2">
                    <Flag url={championTeam.flag_url} alt="" />
                    <span className="text-sm font-medium text-zinc-200">{championTeam.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Você não palpitou</p>
                )}
              </EspecialCard>

              <EspecialCard title="⚽ Artilheiro da Copa" bet={topScorerBet}>
                {topScorerPlayer ? (
                  <div className="flex items-center gap-2">
                    <Flag url={topScorerTeam?.flag_url} alt="" />
                    <span className="text-sm font-medium text-zinc-200">{topScorerPlayer.name}</span>
                    <span className="text-xs text-zinc-500">
                      ({topScorerPlayer.goals_in_tournament} gol{topScorerPlayer.goals_in_tournament === 1 ? '' : 's'})
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Você não palpitou</p>
                )}
              </EspecialCard>

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Artilheiro por Seleção
                </h2>
                {teamScorerBets.length === 0 ? (
                  <p className="text-sm text-zinc-500">Você não palpitou em nenhuma seleção</p>
                ) : (
                  <div className="space-y-3">
                    {teamScorerBets.map(bet => {
                      const team = bet.team_id ? teamsById.get(bet.team_id) : undefined
                      const player = bet.player_id ? playersById.get(bet.player_id) : undefined
                      return (
                        <EspecialCard key={bet.id} title={`Artilheiro — ${team?.name ?? '?'}`} bet={bet}>
                          <div className="flex items-center gap-2">
                            <Flag url={team?.flag_url} alt="" />
                            <span className="text-sm font-medium text-zinc-200">{player?.name ?? '?'}</span>
                            {player && (
                              <span className="text-xs text-zinc-500">
                                ({player.goals_in_tournament} gol{player.goals_in_tournament === 1 ? '' : 's'})
                              </span>
                            )}
                          </div>
                        </EspecialCard>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="resumo">
            <ResumoTab
              bets={bets}
              matches={matches}
              groupBets={groupBets}
              specialBets={specialBets}
              ranking={ranking}
              userId={userId}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
