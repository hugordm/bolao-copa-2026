'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isMatchLive, isLiveWithoutScore } from '@/lib/matchStatus'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

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
  resultado_tipo: 'normal' | 'prorrogacao' | 'penaltis' | null
  vencedor_penaltis_nome: string | null
}

const PHASES: { value: Phase; label: string }[] = [
  { value: 'groups', label: 'Fase de Grupos' },
  { value: 'r32', label: '32 avos de final' },
  { value: 'r16', label: '16 avos de final (Oitavas)' },
  { value: 'qf', label: 'Quartas de final' },
  { value: 'sf', label: 'Semifinais' },
  { value: 'final', label: 'Final' },
]

const RODADA_LABELS = ['Rodada 1', 'Rodada 2', 'Rodada 3']

type Status = 'live' | 'upcoming' | 'done' | 'empty'

function singleOrFirst<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function Flag({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) return <span className="text-lg">🏳️</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-6 rounded-full object-cover shrink-0" />
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

function statusOfList(matches: Match[], now: number): Status {
  if (matches.length === 0) return 'empty'
  if (matches.some(m => isMatchLive(m.kickoff_at, m.is_finished, now))) return 'live'
  if (matches.some(m => !m.is_finished)) return 'upcoming'
  return 'done'
}

/** Picks the "current" entry: the first live/upcoming one, falling back to the
 *  last finished one, or simply the first entry if nothing has happened yet. */
function pickDefault<T>(items: { key: T; status: Status }[]): T {
  const ativo = items.find(i => i.status === 'live' || i.status === 'upcoming')
  if (ativo) return ativo.key
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].status === 'done') return items[i].key
  }
  return items[0].key
}

/** Splits the group-stage matches into 3 chronological rounds (24 jogos cada):
 *  for each group, its 1st/2nd matches go to rodada 1, 3rd/4th to rodada 2, etc. */
function splitGroupRounds(matches: Match[]): Match[][] {
  const byGroup = new Map<string, Match[]>()
  for (const m of matches) {
    const g = m.group_name ?? ''
    const list = byGroup.get(g) ?? []
    list.push(m)
    byGroup.set(g, list)
  }

  const rounds: Match[][] = [[], [], []]
  for (const list of byGroup.values()) {
    const ordered = [...list].sort(
      (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    )
    ordered.forEach((m, idx) => rounds[Math.min(2, Math.floor(idx / 2))].push(m))
  }
  for (const round of rounds) {
    round.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
  }
  return rounds
}

function StatusBadge({ match, now }: { match: Match; now: number }) {
  if (match.is_finished) {
    return <Badge className="bg-zinc-700/50 text-zinc-400 border-zinc-600/40">Encerrado</Badge>
  }
  if (isMatchLive(match.kickoff_at, match.is_finished, now)) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
        🔴 AO VIVO
      </Badge>
    )
  }
  return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Agendado</Badge>
}

function MatchCard({ match, now }: { match: Match; now: number }) {
  const aoVivo = isMatchLive(match.kickoff_at, match.is_finished, now)
  const semPlacar = isLiveWithoutScore(aoVivo, match.home_score, match.away_score)
  const mostrarPlacar = (match.is_finished || aoVivo) && !semPlacar

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {match.group_name ? `Gr. ${match.group_name}` : ' '}
        </span>
        <StatusBadge match={match} now={now} />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Flag url={match.home_team.flag_url} alt="" />
          <span className="truncate text-sm font-semibold text-zinc-100">{match.home_team.name}</span>
        </div>
        <div className="shrink-0 px-2 text-center">
          {mostrarPlacar ? (
            <div>
              <span className="text-base font-bold tabular-nums text-zinc-50">
                {match.home_score ?? 0}–{match.away_score ?? 0}
              </span>
              {match.is_finished && match.resultado_tipo === 'prorrogacao' && (
                <p className="text-[10px] text-zinc-500 mt-0.5 whitespace-nowrap">após prorrogação</p>
              )}
              {match.is_finished && match.resultado_tipo === 'penaltis' && match.vencedor_penaltis_nome && (
                <p className="text-[10px] text-zinc-500 mt-0.5 whitespace-nowrap">{match.vencedor_penaltis_nome} nos pênaltis</p>
              )}
            </div>
          ) : semPlacar ? (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse whitespace-nowrap">
              🔴 EM ANDAMENTO
            </Badge>
          ) : (
            <span className="text-xs font-medium text-zinc-400 whitespace-nowrap">
              {formatDateTime(match.kickoff_at)}
            </span>
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-zinc-100 text-right">{match.away_team.name}</span>
          <Flag url={match.away_team.flag_url} alt="" />
        </div>
      </div>
    </div>
  )
}

function MatchList({ matches, now }: { matches: Match[]; now: number }) {
  if (matches.length === 0) {
    return <p className="text-center text-sm text-zinc-500 py-8">Nenhum jogo definido ainda</p>
  }
  return (
    <div className="space-y-2">
      {matches.map(m => <MatchCard key={m.id} match={m} now={now} />)}
    </div>
  )
}

export default function ResultadosPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const fetchMatches = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('matches')
      .select(
        'id, kickoff_at, home_score, away_score, is_finished, phase, group_name, resultado_tipo, vencedor_penaltis:teams!vencedor_penaltis_id(name), home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url)'
      )
      .order('kickoff_at', { ascending: true })

    if (data) {
      setMatches(
        data.map((m): Match => ({
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
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMatches()

    const supabase = createClient()
    const channel = supabase
      .channel('resultados-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchMatches)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchMatches])

  const byPhase = useMemo(() => {
    const map = new Map<Phase, Match[]>()
    for (const m of matches) {
      const list = map.get(m.phase) ?? []
      list.push(m)
      map.set(m.phase, list)
    }
    return map
  }, [matches])

  const groupRounds = useMemo(() => splitGroupRounds(byPhase.get('groups') ?? []), [byPhase])

  const defaultPhase = useMemo(
    () => pickDefault(PHASES.map(p => ({ key: p.value, status: statusOfList(byPhase.get(p.value) ?? [], now) }))),
    [byPhase, now]
  )

  const defaultRound = useMemo(
    () => pickDefault(groupRounds.map((round, idx) => ({ key: `rodada-${idx + 1}`, status: statusOfList(round, now) }))),
    [groupRounds, now]
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-1">📅 Resultados e Calendário</h1>
      <p className="mb-4 text-sm text-zinc-500">Todos os jogos da Copa, organizados por fase e rodada</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue={defaultPhase}>
          <div className="overflow-x-auto -mx-4 px-4 mb-4 pb-1">
            <TabsList className="w-max gap-1 bg-zinc-900 border border-zinc-800">
              {PHASES.map(p => {
                const status = statusOfList(byPhase.get(p.value) ?? [], now)
                return (
                  <TabsTrigger
                    key={p.value}
                    value={p.value}
                    className="whitespace-nowrap text-xs px-2.5 py-1.5 data-active:bg-emerald-500 data-active:text-white"
                  >
                    {status === 'live' && (
                      <span className="size-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                    )}
                    {p.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          <TabsContent value="groups">
            <Accordion type="single" collapsible defaultValue={defaultRound}>
              {groupRounds.map((round, idx) => {
                const status = statusOfList(round, now)
                return (
                  <AccordionItem key={idx} value={`rodada-${idx + 1}`}>
                    <AccordionTrigger className="text-zinc-100">
                      <span className="flex items-center gap-2">
                        {RODADA_LABELS[idx]}
                        {status === 'live' && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
                            🔴 AO VIVO
                          </Badge>
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <MatchList matches={round} now={now} />
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </TabsContent>

          {PHASES.filter(p => p.value !== 'groups').map(p => (
            <TabsContent key={p.value} value={p.value}>
              <MatchList matches={byPhase.get(p.value) ?? []} now={now} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
