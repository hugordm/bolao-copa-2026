'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isMatchLive } from '@/lib/matchStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Time = {
  name: string
  flag_url: string | null
}

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
}

type Bet = {
  id: string
  match_id: string
  home_score_bet: number
  away_score_bet: number
  points_earned: number | null
  edit_count: number
}

type Filtro = 'todos' | 'hoje' | 'amanha' | 'pendentes' | 'encerrados'

const MAX_EDITS = 3

function dataBrasilia(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
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

function singleOrFirst<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function EdicoesBadge({ editCount }: { editCount: number }) {
  const restantes = MAX_EDITS - editCount
  if (restantes <= 0) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueado</Badge>
  }
  if (restantes === 1) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        1x restante
      </Badge>
    )
  }
  return (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
      {restantes}x restantes
    </Badge>
  )
}

function FechamentoInfo({ kickoffAt, now }: { kickoffAt: string; now: number }) {
  const totalMinutos = Math.max(0, Math.floor((new Date(kickoffAt).getTime() - now) / 60000))

  if (totalMinutos < 5) {
    return <p className="mt-2 text-xs font-semibold text-amber-400">🔒 Fechando...</p>
  }
  if (totalMinutos < 60) {
    return (
      <p className="mt-2 text-xs font-semibold text-red-400 animate-pulse">
        ⚠️ Fecha em {totalMinutos} minuto{totalMinutos === 1 ? '' : 's'}!
      </p>
    )
  }
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  return (
    <p className="mt-2 text-xs text-zinc-500">
      Fecha em {horas} hora{horas === 1 ? '' : 's'} {minutos} minuto{minutos === 1 ? '' : 's'}
    </p>
  )
}

export default function PalpitesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [bets, setBets] = useState<Record<string, Bet>>({})
  const [inputs, setInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loadingIa, setLoadingIa] = useState<Record<string, boolean>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [loading, setLoading] = useState(true)
  const [iaDialog, setIaDialog] = useState<{
    open: boolean
    matchId: string
    sugestao: { home_score: number; away_score: number; justificativa: string } | null
  }>({ open: false, matchId: '', sugestao: null })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: matchData } = await supabase
        .from('matches')
        .select(
          'id, kickoff_at, home_score, away_score, is_finished, phase, group_name, home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url)'
        )
        .order('kickoff_at', { ascending: true })

      const { data: betData } = await supabase
        .from('bets')
        .select('id, match_id, home_score_bet, away_score_bet, points_earned, edit_count')
        .eq('user_id', user.id)

      if (matchData) {
        setMatches(
          matchData.map((m): Match => ({
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

      const betMap: Record<string, Bet> = {}
      const inputMap: Record<string, { home: string; away: string }> = {}
      for (const b of betData ?? []) {
        betMap[b.match_id] = b
        inputMap[b.match_id] = {
          home: String(b.home_score_bet),
          away: String(b.away_score_bet),
        }
      }
      setBets(betMap)
      setInputs(inputMap)
      setLoading(false)
    }
    load()
  }, [])

  function getInput(matchId: string) {
    return inputs[matchId] ?? { home: '', away: '' }
  }

  function setInput(matchId: string, field: 'home' | 'away', val: string) {
    setInputs(prev => ({
      ...prev,
      [matchId]: { ...getInput(matchId), [field]: val },
    }))
  }

  async function salvarPalpite(match: Match) {
    const inp = getInput(match.id)
    const home = parseInt(inp.home)
    const away = parseInt(inp.away)
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      toast.error('Informe placar válido')
      return
    }
    const bet = bets[match.id]
    if (bet && bet.edit_count >= MAX_EDITS) {
      toast.error('Limite de edições atingido')
      return
    }
    setSaving(s => ({ ...s, [match.id]: true }))
    try {
      const supabase = createClient()
      if (bet) {
        const { data, error } = await supabase
          .from('bets')
          .update({
            home_score_bet: home,
            away_score_bet: away,
            edit_count: bet.edit_count + 1,
          })
          .eq('id', bet.id)
          .select('id, match_id, home_score_bet, away_score_bet, points_earned, edit_count')
          .single()
        if (error) throw error
        setBets(b => ({ ...b, [match.id]: data }))
      } else {
        const { data, error } = await supabase
          .from('bets')
          .insert({
            user_id: userId,
            match_id: match.id,
            home_score_bet: home,
            away_score_bet: away,
            edit_count: 1,
          })
          .select('id, match_id, home_score_bet, away_score_bet, points_earned, edit_count')
          .single()
        if (error) throw error
        setBets(b => ({ ...b, [match.id]: data }))
      }
      toast.success('Palpite salvo!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar palpite')
    } finally {
      setSaving(s => ({ ...s, [match.id]: false }))
    }
  }

  async function pedirSugestaoIa(matchId: string) {
    setLoadingIa(l => ({ ...l, [matchId]: true }))
    try {
      const res = await fetch(`/api/ia/sugestao-palpite?match_id=${matchId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setIaDialog({ open: true, matchId, sugestao: data })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar sugestão')
    } finally {
      setLoadingIa(l => ({ ...l, [matchId]: false }))
    }
  }

  function aceitarSugestao() {
    if (!iaDialog.sugestao) return
    setInput(iaDialog.matchId, 'home', String(iaDialog.sugestao.home_score))
    setInput(iaDialog.matchId, 'away', String(iaDialog.sugestao.away_score))
    setIaDialog(d => ({ ...d, open: false }))
  }

  const hoje = dataBrasilia(new Date().toISOString())
  const amanha = dataBrasilia(new Date(Date.now() + 86400000).toISOString())

  const matchesFiltrados = matches.filter(m => {
    if (filtro === 'hoje') return dataBrasilia(m.kickoff_at) === hoje
    if (filtro === 'amanha') return dataBrasilia(m.kickoff_at) === amanha
    if (filtro === 'pendentes') return !m.is_finished && !isMatchLive(m.kickoff_at, m.is_finished, now) && !bets[m.id]
    if (filtro === 'encerrados') return m.is_finished
    return true
  })

  const filtros: { label: string; value: Filtro }[] = [
    { label: 'Todos', value: 'todos' },
    { label: 'Hoje', value: 'hoje' },
    { label: 'Amanhã', value: 'amanha' },
    { label: 'Pendentes', value: 'pendentes' },
    { label: 'Encerrados', value: 'encerrados' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-4">⚽ Palpites de Placar</h1>

      <div className="flex gap-2 flex-wrap mb-6">
        {filtros.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filtro === f.value
                ? 'bg-emerald-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : matchesFiltrados.length === 0 ? (
        <p className="text-center text-zinc-500 py-12">Nenhum jogo encontrado</p>
      ) : (
        <div className="space-y-3">
          {matchesFiltrados.map(match => {
            const bet = bets[match.id]
            const aoVivo = isMatchLive(match.kickoff_at, match.is_finished, now)
            const finalizado = match.is_finished
            const bloqueado = bet && bet.edit_count >= MAX_EDITS
            const inputsBloqueados = !!bloqueado || aoVivo
            const inp = getInput(match.id)

            return (
              <div key={match.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-xs text-zinc-500 mb-1">
                      {match.phase}{match.group_name ? ` · Gr.${match.group_name}` : ''} · {formatDateTime(match.kickoff_at)}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
                        {match.home_team.flag_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={match.home_team.flag_url} alt="" className="size-5 rounded-full object-cover" />
                        )}
                        {match.home_team.name}
                      </span>
                      <span className="text-zinc-500">×</span>
                      <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
                        {match.away_team.flag_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={match.away_team.flag_url} alt="" className="size-5 rounded-full object-cover" />
                        )}
                        {match.away_team.name}
                      </span>
                    </div>
                  </div>
                  {match.is_finished && (
                    <span className="text-sm font-bold text-zinc-300 ml-3">
                      {match.home_score}–{match.away_score}
                    </span>
                  )}
                </div>

                {!finalizado ? (
                  <>
                    {aoVivo && (
                      <Badge className="mb-3 bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
                        🔴 AO VIVO — palpites bloqueados
                      </Badge>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={inp.home}
                        onChange={e => setInput(match.id, 'home', e.target.value)}
                        disabled={inputsBloqueados}
                        className="w-16 text-center bg-zinc-800 border-zinc-700 text-zinc-50 h-9"
                      />
                      <span className="text-zinc-500 font-bold">×</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={inp.away}
                        onChange={e => setInput(match.id, 'away', e.target.value)}
                        disabled={inputsBloqueados}
                        className="w-16 text-center bg-zinc-800 border-zinc-700 text-zinc-50 h-9"
                      />
                      <EdicoesBadge editCount={bet?.edit_count ?? 0} />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={inputsBloqueados || saving[match.id]}
                        onClick={() => salvarPalpite(match)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      >
                        {saving[match.id] ? <Loader2 className="size-3 animate-spin" /> : 'Salvar palpite'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingIa[match.id] || aoVivo}
                        onClick={() => pedirSugestaoIa(match.id)}
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      >
                        {loadingIa[match.id] ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <><Bot className="size-3" /> Sugestão IA</>
                        )}
                      </Button>
                    </div>
                    {!aoVivo && <FechamentoInfo kickoffAt={match.kickoff_at} now={now} />}
                  </>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-sm text-zinc-400">
                      Seu palpite:{' '}
                      {bet ? (
                        <span className="font-bold text-zinc-200">
                          {bet.home_score_bet} × {bet.away_score_bet}
                        </span>
                      ) : (
                        <span className="text-zinc-600">Não palpitou</span>
                      )}
                    </div>
                    {match.is_finished && bet?.points_earned != null && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        +{bet.points_earned} pts
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={iaDialog.open} onOpenChange={open => setIaDialog(d => ({ ...d, open }))}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5 text-emerald-400" />
              Sugestão da IA
            </DialogTitle>
          </DialogHeader>
          {iaDialog.sugestao && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-black text-zinc-50">
                  {iaDialog.sugestao.home_score} × {iaDialog.sugestao.away_score}
                </p>
              </div>
              <p className="text-sm text-zinc-300 text-center leading-relaxed">
                {iaDialog.sugestao.justificativa}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={aceitarSugestao}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  Aceitar sugestão
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIaDialog(d => ({ ...d, open: false }))}
                  className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Ignorar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
