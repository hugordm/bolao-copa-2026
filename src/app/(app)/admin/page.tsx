'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Search, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ScoreConfig } from '@/lib/types'

// ============ helpers ============

function singleOrFirst<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro na requisição')
  return data
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

// ============ types ============

type Time = { name: string }

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

type Player = {
  id: string
  name: string
  team_id: string
  team_name: string
  goals_in_tournament: number
}

type TeamElim = {
  id: string
  name: string
  flag_url: string | null
  is_eliminated: boolean
}

type UserRow = {
  id: string
  name: string
  email: string
  is_admin: boolean
  created_at: string
  total_points: number
}

// ============ sub-tabs ============

function TabResultados() {
  const [matches, setMatches] = useState<Match[]>([])
  const [scores, setScores] = useState<Record<string, { home: string; away: string; finished: boolean }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [{ data: matchData }, { data: configData }] = await Promise.all([
      supabase
        .from('matches')
        .select(
          'id, kickoff_at, home_score, away_score, is_finished, phase, group_name, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)'
        )
        .order('kickoff_at'),
      supabase.from('score_config').select('last_sync').order('updated_at', { ascending: false }).limit(1).single(),
    ])

    if (matchData) {
      const mapped: Match[] = matchData.map(m => ({
        id: m.id,
        kickoff_at: m.kickoff_at,
        home_score: m.home_score,
        away_score: m.away_score,
        is_finished: m.is_finished,
        phase: m.phase,
        group_name: m.group_name,
        home_team: singleOrFirst<Time>(m.home_team) ?? { name: '?' },
        away_team: singleOrFirst<Time>(m.away_team) ?? { name: '?' },
      }))
      setMatches(mapped)
      const s: typeof scores = {}
      for (const m of mapped) {
        s[m.id] = {
          home: m.home_score != null ? String(m.home_score) : '',
          away: m.away_score != null ? String(m.away_score) : '',
          finished: m.is_finished,
        }
      }
      setScores(s)
    }
    setLastSync(configData?.last_sync ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function salvar(match: Match) {
    const sc = scores[match.id]
    setSaving(s => ({ ...s, [match.id]: true }))
    try {
      const supabase = createClient()
      const home = sc.home !== '' ? parseInt(sc.home) : null
      const away = sc.away !== '' ? parseInt(sc.away) : null
      const { error } = await supabase
        .from('matches')
        .update({ home_score: home, away_score: away, is_finished: sc.finished })
        .eq('id', match.id)
      if (error) throw error

      if (sc.finished) {
        await postJson('/api/admin/calcular-pontos', { match_id: match.id })
      }
      toast.success('Jogo atualizado!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(s => ({ ...s, [match.id]: false }))
    }
  }

  async function sincronizar() {
    setSyncing(true)
    try {
      const data = await postJson('/api/cron/sync')
      toast.success(
        `Sincronizado! ${data.resultados?.updated ?? 0} jogo(s) atualizados, ${data.resultados?.calculated ?? 0} palpite(s) recalculados`
      )
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const filtered = matches.filter(
    m =>
      !filter ||
      m.home_team.name.toLowerCase().includes(filter.toLowerCase()) ||
      m.away_team.name.toLowerCase().includes(filter.toLowerCase()) ||
      m.phase.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-zinc-500">
          Última sincronização: {lastSync ? formatDateTime(lastSync) : 'nunca'}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={sincronizar}
          disabled={syncing}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          {syncing ? <Loader2 className="size-3 animate-spin" /> : <><RefreshCw className="size-3" /> Sincronizar agora</>}
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
        <Input
          placeholder="Filtrar por time ou fase..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-50 h-10"
        />
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const sc = scores[m.id] ?? { home: '', away: '', finished: false }
            return (
              <div key={m.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-xs text-zinc-500 mb-2">
                  {m.phase}{m.group_name ? ` · Gr.${m.group_name}` : ''} · {formatDateTime(m.kickoff_at)}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-100 flex-1 min-w-0 truncate">{m.home_team.name}</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={sc.home}
                    onChange={e => setScores(s => ({ ...s, [m.id]: { ...sc, home: e.target.value } }))}
                    className="w-14 text-center bg-zinc-800 border-zinc-700 text-zinc-50 h-8"
                  />
                  <span className="text-zinc-500">×</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={sc.away}
                    onChange={e => setScores(s => ({ ...s, [m.id]: { ...sc, away: e.target.value } }))}
                    className="w-14 text-center bg-zinc-800 border-zinc-700 text-zinc-50 h-8"
                  />
                  <span className="text-sm font-semibold text-zinc-100 flex-1 min-w-0 truncate text-right">{m.away_team.name}</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sc.finished}
                      onChange={e => setScores(s => ({ ...s, [m.id]: { ...sc, finished: e.target.checked } }))}
                      className="rounded border-zinc-600"
                    />
                    Encerrado
                  </label>
                  <Button
                    size="sm"
                    onClick={() => salvar(m)}
                    disabled={saving[m.id]}
                    className="ml-auto bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    {saving[m.id] ? <Loader2 className="size-3 animate-spin" /> : 'Salvar'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabArtilharia() {
  const [players, setPlayers] = useState<Player[]>([])
  const [goals, setGoals] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [syncing, setSyncing] = useState(false)

  async function load() {
    const supabase = createClient()
    type Row = {
      id: string
      name: string
      team_id: string
      goals_in_tournament: number
      teams: { name: string } | { name: string }[] | null
    }
    const PAGE_SIZE = 1000
    const data: Row[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page } = await supabase
        .from('players')
        .select('id, name, team_id, goals_in_tournament, teams(name)')
        .order('name')
        .range(from, from + PAGE_SIZE - 1)
      if (!page) break
      data.push(...(page as Row[]))
      if (page.length < PAGE_SIZE) break
    }
    if (data.length) {
      const mapped = data.map(p => ({
        id: p.id,
        name: p.name,
        team_id: p.team_id,
        team_name: Array.isArray(p.teams) ? (p.teams[0]?.name ?? '') : (p.teams?.name ?? ''),
        goals_in_tournament: p.goals_in_tournament ?? 0,
      }))
      setPlayers(mapped)
      const g: Record<string, string> = {}
      for (const p of mapped) g[p.id] = String(p.goals_in_tournament)
      setGoals(g)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function salvarGols(player: Player) {
    setSaving(s => ({ ...s, [player.id]: true }))
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('players')
        .update({ goals_in_tournament: parseInt(goals[player.id] ?? '0') || 0 })
        .eq('id', player.id)
      if (error) throw error
      toast.success(`${player.name} atualizado!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(s => ({ ...s, [player.id]: false }))
    }
  }

  async function sincronizar() {
    setSyncing(true)
    try {
      const data = await postJson('/api/sync/artilharia')
      toast.success(`Artilharia sincronizada! ${data.updated ?? 0} jogador(es) atualizado(s)`)
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const filtered = players.filter(
    p => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.team_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={sincronizar}
          disabled={syncing}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          {syncing ? <Loader2 className="size-3 animate-spin" /> : <><RefreshCw className="size-3" /> Sincronizar artilharia</>}
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
        <Input
          placeholder="Buscar jogador ou seleção..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-50 h-10"
        />
      </div>
      <div className="space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{p.name}</p>
              <p className="text-xs text-zinc-500">{p.team_name}</p>
            </div>
            <Input
              type="number"
              min={0}
              value={goals[p.id] ?? '0'}
              onChange={e => setGoals(g => ({ ...g, [p.id]: e.target.value }))}
              className="w-16 text-center bg-zinc-800 border-zinc-700 text-zinc-50 h-8"
            />
            <Button
              size="sm"
              onClick={() => salvarGols(p)}
              disabled={saving[p.id]}
              className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
            >
              {saving[p.id] ? <Loader2 className="size-3 animate-spin" /> : 'OK'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabGruposElim() {
  const [teams, setTeams] = useState<TeamElim[]>([])
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('teams')
      .select('id, name, flag_url, is_eliminated')
      .order('name')
      .then(({ data }) => data && setTeams(data))
  }, [])

  async function toggleElim(team: TeamElim) {
    setSaving(s => ({ ...s, [team.id]: true }))
    try {
      const supabase = createClient()
      const novo = !team.is_eliminated
      const { error } = await supabase
        .from('teams')
        .update({ is_eliminated: novo })
        .eq('id', team.id)
      if (error) throw error
      setTeams(ts => ts.map(t => t.id === team.id ? { ...t, is_eliminated: novo } : t))

      if (novo) {
        const data = await postJson('/api/admin/apurar-artilheiro-selecao', { team_id: team.id })
        toast.success(`${team.name} eliminada — artilheiro: ${data.winner ?? '—'}`)
      } else {
        toast.success(`${team.name} reativada`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setSaving(s => ({ ...s, [team.id]: false }))
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {teams.map(t => (
        <button
          key={t.id}
          onClick={() => toggleElim(t)}
          disabled={saving[t.id]}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
            t.is_eliminated
              ? 'border-red-500/50 bg-red-500/10 opacity-60'
              : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
          }`}
        >
          {t.flag_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.flag_url} alt="" className="size-6 rounded-full object-cover" />
          ) : (
            <span className="text-lg">🏳️</span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">{t.name}</p>
            {t.is_eliminated && <p className="text-xs text-red-400">Eliminada</p>}
          </div>
          {saving[t.id] && <Loader2 className="size-3 animate-spin ml-auto text-zinc-500" />}
        </button>
      ))}
    </div>
  )
}

type ScoreConfigForm = Omit<ScoreConfig, 'id' | 'last_sync'>

const SCORE_CONFIG_DEFAULTS: ScoreConfigForm = {
  pts_exact_score: 3,
  pts_correct_result: 1,
  pts_group_1st: 5,
  pts_group_order_partial: 1,
  pts_group_order_exact: 3,
  pts_champion: 10,
  pts_top_scorer: 8,
  pts_team_scorer: 5,
}

function TabPontuacao() {
  const [config, setConfig] = useState<{ id: string } | null>(null)
  const [form, setForm] = useState<ScoreConfigForm>(SCORE_CONFIG_DEFAULTS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('score_config')
      .select(
        'id, pts_exact_score, pts_correct_result, pts_group_1st, pts_group_order_partial, pts_group_order_exact, pts_champion, pts_top_scorer, pts_team_scorer'
      )
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          const { id, ...rest } = data
          setConfig({ id })
          setForm(rest)
        }
      })
  }, [])

  function field(key: keyof ScoreConfigForm, label: string) {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-zinc-400">{label}</Label>
        <Input
          type="number"
          min={0}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
          className="bg-zinc-800 border-zinc-700 text-zinc-50 h-9"
        />
      </div>
    )
  }

  async function salvar() {
    setSaving(true)
    try {
      const supabase = createClient()
      if (config) {
        const { error } = await supabase.from('score_config').update(form).eq('id', config.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('score_config').insert(form)
        if (error) throw error
      }
      toast.success('Configuração salva!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">
        ⚠️ Alterações valem para novos cálculos. Jogos já calculados não são reprocessados automaticamente.
      </p>
      {field('pts_exact_score', 'Placar exato')}
      {field('pts_correct_result', 'Resultado correto (sem placar exato)')}
      {field('pts_group_1st', '1º lugar do grupo')}
      {field('pts_group_order_partial', 'Ordem de grupo parcial')}
      {field('pts_group_order_exact', 'Ordem de grupo exata')}
      {field('pts_champion', 'Campeão')}
      {field('pts_top_scorer', 'Artilheiro da copa')}
      {field('pts_team_scorer', 'Artilheiro por seleção')}
      <Button
        onClick={salvar}
        disabled={saving}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : 'Salvar configuração'}
      </Button>
    </div>
  )
}

function TabUsuarios() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('users')
      .select('id, name, email, is_admin, created_at, bets(points_earned), group_order_bets(points_earned), special_bets(points_earned)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        const mapped = (data as Array<{
          id: string
          name: string
          email: string
          is_admin: boolean
          created_at: string
          bets?: Array<{ points_earned: number | null }>
          group_order_bets?: Array<{ points_earned: number | null }>
          special_bets?: Array<{ points_earned: number | null }>
        }>).map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          is_admin: u.is_admin,
          created_at: u.created_at,
          total_points:
            (u.bets ?? []).reduce((s, b) => s + (b.points_earned ?? 0), 0) +
            (u.group_order_bets ?? []).reduce((s, b) => s + (b.points_earned ?? 0), 0) +
            (u.special_bets ?? []).reduce((s, b) => s + (b.points_earned ?? 0), 0),
        }))
        mapped.sort((a, b) => b.total_points - a.total_points)
        setUsers(mapped)
        setLoading(false)
      })
  }, [])

  async function toggleAdmin(user: UserRow) {
    setSaving(s => ({ ...s, [user.id]: true }))
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ is_admin: !user.is_admin })
        .eq('id', user.id)
      if (error) throw error
      setUsers(us => us.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u))
      toast.success(`${user.name} ${!user.is_admin ? 'virou admin' : 'deixou de ser admin'}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setSaving(s => ({ ...s, [user.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-zinc-800 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{u.name}</p>
            <p className="text-xs text-zinc-500 truncate">{u.email}</p>
            <p className="text-xs text-zinc-600">
              {new Intl.DateTimeFormat('pt-BR').format(new Date(u.created_at))}
            </p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
            {u.total_points} pts
          </Badge>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={u.is_admin}
              onChange={() => toggleAdmin(u)}
              disabled={saving[u.id]}
              className="rounded border-zinc-600"
            />
            <span className="text-xs text-zinc-400">Admin</span>
            {saving[u.id] && <Loader2 className="size-3 animate-spin text-zinc-500" />}
          </label>
        </div>
      ))}
    </div>
  )
}

type SeedAcao = {
  key: string
  label: string
  url: string
  desc: string
}

const SEED_ACOES: SeedAcao[] = [
  {
    key: 'times',
    label: 'Popular times',
    url: '/api/sync/times',
    desc: 'Importa os 48 times, grupos e brasões via Zafronix. Use uma vez, antes do início da Copa.',
  },
  {
    key: 'jogos',
    label: 'Popular jogos',
    url: '/api/sync/jogos',
    desc: 'Importa o calendário completo (104 jogos) via Zafronix. Requer que os times já estejam cadastrados. Use uma vez.',
  },
  {
    key: 'jogadores',
    label: 'Popular jogadores',
    url: '/api/sync/jogadores',
    desc: 'Importa os elencos de cada seleção (jogadores e gols) via Zafronix. Requer que os times já estejam cadastrados. Use uma vez.',
  },
  {
    key: 'tudo',
    label: 'Sincronizar tudo agora',
    url: '/api/cron/sync',
    desc: 'Roda o mesmo processo do cron: resultados, artilharia e grupos, via Zafronix.',
  },
]

function TabSeed() {
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, string>>({})

  async function run(acao: SeedAcao) {
    setRunning(r => ({ ...r, [acao.key]: true }))
    try {
      const data = await postJson(acao.url)
      setResults(res => ({ ...res, [acao.key]: JSON.stringify(data) }))
      toast.success(`${acao.label}: concluído`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setRunning(r => ({ ...r, [acao.key]: false }))
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-sky-400 bg-sky-400/10 rounded-lg px-3 py-2">
        ℹ️ Times, jogos, elencos, artilharia e grupos vêm da{' '}
        <a
          href="https://api.zafronix.com/docs"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Zafronix World Cup API
        </a>
        . Configure <code className="font-mono">ZAFRONIX_API_KEY</code> e{' '}
        <code className="font-mono">ZAFRONIX_API_URL</code> no <code className="font-mono">.env.local</code>.
      </p>
      <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">
        ⚠️ As ações de &quot;Popular&quot; devem ser usadas apenas uma vez para preencher a base. Rodar novamente
        atualiza (upsert) os mesmos registros sem duplicar.
      </p>
      {SEED_ACOES.map(a => (
        <div key={a.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-100">{a.label}</p>
            <Button
              size="sm"
              onClick={() => run(a)}
              disabled={running[a.key]}
              className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
            >
              {running[a.key] ? <Loader2 className="size-3 animate-spin" /> : 'Executar'}
            </Button>
          </div>
          <p className="text-xs text-zinc-500">{a.desc}</p>
          {results[a.key] && <p className="text-xs text-zinc-400 font-mono break-all">{results[a.key]}</p>}
        </div>
      ))}
    </div>
  )
}

// ============ main ============

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      if (!data?.is_admin) { router.replace('/dashboard'); return }
      setChecking(false)
    }
    check()
  }, [router])

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-6">🔧 Painel Admin</h1>

      <Tabs defaultValue="resultados">
        <TabsList className="flex flex-wrap bg-zinc-900 border border-zinc-800 mb-6 h-auto gap-0.5 p-1">
          {[
            ['resultados', 'Resultados'],
            ['artilharia', 'Artilharia'],
            ['grupos', 'Grupos e Eliminação'],
            ['pontuacao', 'Configuração de Pontuação'],
            ['usuarios', 'Usuários'],
            ['seed', 'Popular Dados'],
          ].map(([v, l]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="text-xs data-active:bg-emerald-500 data-active:text-white"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resultados"><TabResultados /></TabsContent>
        <TabsContent value="artilharia"><TabArtilharia /></TabsContent>
        <TabsContent value="grupos"><TabGruposElim /></TabsContent>
        <TabsContent value="pontuacao"><TabPontuacao /></TabsContent>
        <TabsContent value="usuarios"><TabUsuarios /></TabsContent>
        <TabsContent value="seed"><TabSeed /></TabsContent>
      </Tabs>
    </div>
  )
}
