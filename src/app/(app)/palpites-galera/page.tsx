'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { resultado } from '@/lib/scoring'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Time = { name: string; flag_url: string | null }

type Match = {
  id: string
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  is_finished: boolean
  phase: string
  group_name: string | null
  home_team: Time
  away_team: Time
  resultado_tipo: 'normal' | 'prorrogacao' | 'penaltis' | null
  vencedor_penaltis_nome: string | null
}

type Bet = {
  id: string
  user_id: string
  match_id: string
  home_score_bet: number
  away_score_bet: number
  points_earned: number | null
}

type Participante = {
  id: string
  name: string
  avatar_url: string | null
}

type TeamRef = { name: string; flag_url: string | null }

type PlayerRef = {
  name: string
  team_id: string
  teams: TeamRef | TeamRef[] | null
}

type SpecialBetType = 'champion' | 'top_scorer' | 'team_scorer'

type SpecialBetRow = {
  user_id: string
  bet_type: SpecialBetType
  team_id: string | null
  player_id: string | null
  team: TeamRef | TeamRef[] | null
  player: PlayerRef | PlayerRef[] | null
}

type ArtilheiroBet = {
  user_id: string
  bet_type: SpecialBetType
  player_name: string
  player_team: TeamRef
  team_id: string | null
  team: TeamRef | null
}

type ChampionBet = {
  user_id: string
  team: TeamRef
}

type AbaTempo = 'hoje' | 'amanha' | 'todos'
type Aba = AbaTempo | 'artilheiros' | 'campeao'

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-blue-600', 'bg-violet-600', 'bg-orange-600',
  'bg-pink-600', 'bg-cyan-600', 'bg-yellow-600', 'bg-red-600',
]

function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function singleOrFirst<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function dataBrasilia(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function formatHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDataCompleta(date: Date): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function Flag({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) return <span className="text-lg">🏳️</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-5 rounded-full object-cover" />
}

// ---------------------------------------------------------------------------
// Status do palpite
// ---------------------------------------------------------------------------

type PalpiteStatus = 'exato' | 'certo' | 'errado' | 'pendente' | 'sem_palpite'

const STATUS_STYLES = {
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  zinc: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  zincEscuro: 'bg-zinc-800 text-zinc-600 border-zinc-700',
} as const

type StatusColor = keyof typeof STATUS_STYLES

const STATUS_INFO: Record<PalpiteStatus, { color: StatusColor; label: string }> = {
  exato: { color: 'emerald', label: '🎯 Exato!' },
  certo: { color: 'blue', label: '✅ Certo' },
  errado: { color: 'red', label: '❌ Errou' },
  pendente: { color: 'zinc', label: '⏳ Pendente' },
  sem_palpite: { color: 'zincEscuro', label: '— Não palpitou' },
}

function getPalpiteStatus(bet: Bet | undefined, match: Match): PalpiteStatus {
  if (!bet) return 'sem_palpite'
  if (!match.is_finished || match.home_score == null || match.away_score == null) return 'pendente'
  if (bet.home_score_bet === match.home_score && bet.away_score_bet === match.away_score) return 'exato'
  if (resultado(bet.home_score_bet, bet.away_score_bet) === resultado(match.home_score, match.away_score)) return 'certo'
  return 'errado'
}

function StatusBadge({ color, children }: { color: StatusColor; children: React.ReactNode }) {
  return <Badge className={STATUS_STYLES[color]}>{children}</Badge>
}

// ---------------------------------------------------------------------------
// Card do jogo
// ---------------------------------------------------------------------------

function MatchCard({
  match,
  betsByUser,
  participantes,
  userId,
  index,
}: {
  match: Match
  betsByUser: Map<string, Bet>
  participantes: Participante[]
  userId: string | null
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.25 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-800/40 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Flag url={match.home_team.flag_url} alt="" />
          <span className="truncate font-semibold text-zinc-100">{match.home_team.name}</span>
          {match.is_finished && match.home_score != null && match.away_score != null ? (
            <span className="mx-1 shrink-0 rounded bg-zinc-950 px-2 py-0.5 text-sm font-black text-zinc-50">
              {match.home_score} × {match.away_score}
            </span>
          ) : (
            <span className="mx-1 shrink-0 text-sm font-bold text-zinc-500">×</span>
          )}
          <span className="truncate font-semibold text-zinc-100">{match.away_team.name}</span>
          <Flag url={match.away_team.flag_url} alt="" />
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs font-semibold text-zinc-500">
            {match.is_finished ? 'Encerrado' : formatHora(match.kickoff_at)}
          </span>
          {match.is_finished && match.resultado_tipo === 'prorrogacao' && (
            <p className="text-[10px] text-zinc-600 whitespace-nowrap">após prorrogação</p>
          )}
          {match.is_finished && match.resultado_tipo === 'penaltis' && match.vencedor_penaltis_nome && (
            <p className="text-[10px] text-zinc-600 whitespace-nowrap">{match.vencedor_penaltis_nome} nos pênaltis</p>
          )}
        </div>
      </div>

      <div className="divide-y divide-zinc-800/70">
        {participantes.map(p => {
          const bet = betsByUser.get(p.id)
          const status = getPalpiteStatus(bet, match)
          const info = STATUS_INFO[status]
          const isMe = p.id === userId

          return (
            <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(p.name)}`}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-medium text-zinc-200">{p.name}</span>
                {isMe && (
                  <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    VOCÊ
                  </span>
                )}
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-zinc-300">
                {bet ? `${bet.home_score_bet} × ${bet.away_score_bet}` : '—'}
              </span>
              <StatusBadge color={info.color}>{info.label}</StatusBadge>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Cards de Artilheiros
// ---------------------------------------------------------------------------

function ParticipanteRow({
  participante,
  userId,
  children,
}: {
  participante: Participante
  userId: string | null
  children: React.ReactNode
}) {
  const isMe = participante.id === userId

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(participante.name)}`}
      >
        {participante.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-zinc-200">{participante.name}</span>
        {isMe && (
          <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
            VOCÊ
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function CardArtilheiroCopa({
  bets,
  participantes,
  userId,
}: {
  bets: Map<string, ArtilheiroBet>
  participantes: Participante[]
  userId: string | null
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 bg-zinc-800/40 px-4 py-3">
        <h3 className="font-bold text-zinc-50">🏆 Artilheiro da Copa</h3>
      </div>
      <div className="divide-y divide-zinc-800/70">
        {participantes.map(p => {
          const bet = bets.get(p.id)
          return (
            <ParticipanteRow key={p.id} participante={p} userId={userId}>
              {bet ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Flag url={bet.player_team.flag_url} alt="" />
                  <span className="text-sm font-semibold text-zinc-100">{bet.player_name}</span>
                </div>
              ) : (
                <span className="shrink-0 text-sm text-zinc-600">— Não palpitou</span>
              )}
            </ParticipanteRow>
          )
        })}
      </div>
    </div>
  )
}

function CardArtilheiroSelecao({
  team,
  bets,
  participantesById,
  userId,
}: {
  team: TeamRef
  bets: ArtilheiroBet[]
  participantesById: Map<string, Participante>
  userId: string | null
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-800/40 px-4 py-3">
        <Flag url={team.flag_url} alt="" />
        <h3 className="font-bold text-zinc-50">{team.name}</h3>
      </div>
      <div className="divide-y divide-zinc-800/70">
        {bets.map(bet => {
          const p = participantesById.get(bet.user_id)
          if (!p) return null
          return (
            <ParticipanteRow key={bet.user_id} participante={p} userId={userId}>
              <span className="shrink-0 text-sm font-semibold text-zinc-100">{bet.player_name}</span>
            </ParticipanteRow>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card de Campeão
// ---------------------------------------------------------------------------

function CardCampeao({
  championByUser,
  participantes,
  userId,
}: {
  championByUser: Map<string, TeamRef>
  participantes: Participante[]
  userId: string | null
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 bg-zinc-800/40 px-4 py-3">
        <h3 className="font-bold text-zinc-50">🏆 Quem vai ser Campeão?</h3>
      </div>
      <div className="divide-y divide-zinc-800/70">
        {participantes.map(p => {
          const team = championByUser.get(p.id)
          return (
            <ParticipanteRow key={p.id} participante={p} userId={userId}>
              {team ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Flag url={team.flag_url} alt="" />
                  <span className="text-sm font-semibold text-zinc-100">{team.name}</span>
                </div>
              ) : (
                <span className="shrink-0 text-sm text-zinc-600">— Não palpitou</span>
              )}
            </ParticipanteRow>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function PalpitesGaleraPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [artilheiroBets, setArtilheiroBets] = useState<ArtilheiroBet[]>([])
  const [championBets, setChampionBets] = useState<ChampionBet[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('hoje')

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
        { data: usersData },
        { data: specialBetsData },
      ] = await Promise.all([
        supabase
          .from('matches')
          .select(
            'id, kickoff_at, home_score, away_score, is_finished, phase, group_name, resultado_tipo, vencedor_penaltis:teams!vencedor_penaltis_id(name), home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url)'
          )
          .order('kickoff_at', { ascending: true }),
        supabase
          .from('bets')
          .select('id, user_id, match_id, home_score_bet, away_score_bet, points_earned'),
        supabase.from('users').select('id, name, avatar_url').order('name', { ascending: true }),
        supabase
          .from('special_bets')
          .select(
            'user_id, bet_type, team_id, player_id, team:teams(name, flag_url), player:players(name, team_id, teams(name, flag_url))'
          )
          .in('bet_type', ['champion', 'top_scorer', 'team_scorer']),
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
            resultado_tipo: (m.resultado_tipo as Match['resultado_tipo']) ?? null,
            vencedor_penaltis_nome: (singleOrFirst<{ name: string }>(m.vencedor_penaltis as { name: string } | { name: string }[]))?.name ?? null,
          }))
        )
      }
      if (betsData) setBets(betsData)
      if (usersData) setParticipantes(usersData)
      if (specialBetsData) {
        setArtilheiroBets(
          (specialBetsData as SpecialBetRow[])
            .map((b): ArtilheiroBet | null => {
              const player = singleOrFirst<PlayerRef>(b.player)
              if (!player || !b.player_id) return null
              return {
                user_id: b.user_id,
                bet_type: b.bet_type,
                player_name: player.name,
                player_team: singleOrFirst<TeamRef>(player.teams) ?? { name: '?', flag_url: null },
                team_id: b.team_id,
                team: singleOrFirst<TeamRef>(b.team) ?? null,
              }
            })
            .filter((b): b is ArtilheiroBet => !!b)
        )
        setChampionBets(
          (specialBetsData as SpecialBetRow[])
            .filter((b): b is SpecialBetRow & { team_id: string } => b.bet_type === 'champion' && !!b.team_id)
            .map((b): ChampionBet => ({
              user_id: b.user_id,
              team: singleOrFirst<TeamRef>(b.team) ?? { name: '?', flag_url: null },
            }))
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  const betsByMatch = useMemo(() => {
    const map = new Map<string, Map<string, Bet>>()
    for (const bet of bets) {
      let porUsuario = map.get(bet.match_id)
      if (!porUsuario) {
        porUsuario = new Map()
        map.set(bet.match_id, porUsuario)
      }
      porUsuario.set(bet.user_id, bet)
    }
    return map
  }, [bets])

  const participantesById = useMemo(() => {
    const map = new Map<string, Participante>()
    for (const p of participantes) map.set(p.id, p)
    return map
  }, [participantes])

  const championByUser = useMemo(() => {
    const map = new Map<string, TeamRef>()
    for (const bet of championBets) map.set(bet.user_id, bet.team)
    return map
  }, [championBets])

  const topScorerByUser = useMemo(() => {
    const map = new Map<string, ArtilheiroBet>()
    for (const bet of artilheiroBets) {
      if (bet.bet_type === 'top_scorer') map.set(bet.user_id, bet)
    }
    return map
  }, [artilheiroBets])

  const teamScorerGroups = useMemo(() => {
    const groups = new Map<string, { team_id: string; team: TeamRef; bets: ArtilheiroBet[] }>()
    for (const bet of artilheiroBets) {
      if (bet.bet_type !== 'team_scorer' || !bet.team_id || !bet.team) continue
      let group = groups.get(bet.team_id)
      if (!group) {
        group = { team_id: bet.team_id, team: bet.team, bets: [] }
        groups.set(bet.team_id, group)
      }
      group.bets.push(bet)
    }
    return Array.from(groups.values()).sort((a, b) => a.team.name.localeCompare(b.team.name))
  }, [artilheiroBets])

  const agora = new Date()
  const hoje = dataBrasilia(agora.toISOString())
  const amanha = dataBrasilia(new Date(agora.getTime() + 86400000).toISOString())

  const matchesPorAba: Record<AbaTempo, Match[]> = {
    hoje: matches.filter(m => dataBrasilia(m.kickoff_at) === hoje),
    amanha: matches.filter(m => dataBrasilia(m.kickoff_at) === amanha),
    todos: matches,
  }

  const mensagemVazio: Record<AbaTempo, string> = {
    hoje: 'Nenhum jogo hoje 😴',
    amanha: 'Nenhum jogo amanhã 😴',
    todos: 'Nenhum jogo encontrado 😴',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50">Palpites da Galera ⚽</h1>
      <p className="mt-1 mb-4 text-sm text-zinc-500">{formatDataCompleta(agora)}</p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : !userId ? (
        <p className="text-center text-zinc-500 py-12">Faça login para ver os palpites da galera</p>
      ) : (
        <Tabs value={aba} onValueChange={v => setAba(v as Aba)}>
          <TabsList className="w-full bg-zinc-900 border border-zinc-800 mb-6 overflow-x-auto justify-start">
            <TabsTrigger value="hoje" className="flex-1 text-xs sm:text-sm data-active:bg-emerald-500 data-active:text-white">
              Hoje
            </TabsTrigger>
            <TabsTrigger value="amanha" className="flex-1 text-xs sm:text-sm data-active:bg-emerald-500 data-active:text-white">
              Amanhã
            </TabsTrigger>
            <TabsTrigger value="todos" className="flex-1 text-xs sm:text-sm data-active:bg-emerald-500 data-active:text-white">
              Todos
            </TabsTrigger>
            <TabsTrigger value="artilheiros" className="flex-1 text-xs sm:text-sm data-active:bg-emerald-500 data-active:text-white">
              Artilheiros
            </TabsTrigger>
            <TabsTrigger value="campeao" className="flex-1 text-xs sm:text-sm data-active:bg-emerald-500 data-active:text-white">
              Campeão
            </TabsTrigger>
          </TabsList>

          {(['hoje', 'amanha', 'todos'] as AbaTempo[]).map(tab => (
            <TabsContent key={tab} value={tab}>
              {matchesPorAba[tab].length === 0 ? (
                <p className="text-center text-zinc-500 py-12">{mensagemVazio[tab]}</p>
              ) : (
                <div className="space-y-4">
                  {matchesPorAba[tab].map((match, idx) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      betsByUser={betsByMatch.get(match.id) ?? new Map()}
                      participantes={participantes}
                      userId={userId}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}

          <TabsContent value="artilheiros">
            <div className="space-y-4">
              <CardArtilheiroCopa bets={topScorerByUser} participantes={participantes} userId={userId} />
              {teamScorerGroups.map(group => (
                <CardArtilheiroSelecao
                  key={group.team_id}
                  team={group.team}
                  bets={group.bets}
                  participantesById={participantesById}
                  userId={userId}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="campeao">
            <CardCampeao championByUser={championByUser} participantes={participantes} userId={userId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
