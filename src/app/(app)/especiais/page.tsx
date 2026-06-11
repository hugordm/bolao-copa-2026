'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Team = { id: string; name: string; flag_url: string | null; is_eliminated: boolean }
type Player = { id: string; name: string; team_id: string; team_name: string; team_flag: string | null }
type BetType = 'champion' | 'top_scorer' | 'team_scorer'
type SpecialBet = {
  id: string
  bet_type: BetType
  team_id: string | null
  player_id: string | null
  edit_count: number
  is_locked: boolean
}

const MAX_EDITS = 5

function useBets(userId: string | null) {
  const [bets, setBets] = useState<Record<string, SpecialBet>>({})

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    supabase
      .from('special_bets')
      .select('id, bet_type, team_id, player_id, edit_count, is_locked')
      .eq('user_id', userId)
      .then(({ data }) => {
        const map: Record<string, SpecialBet> = {}
        for (const b of data ?? []) {
          const key = b.bet_type === 'team_scorer' && b.team_id ? `team_scorer_${b.team_id}` : b.bet_type
          map[key] = b
        }
        setBets(map)
      })
  }, [userId])

  return { bets, setBets }
}

async function saveBet(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  key: string,
  betType: BetType,
  payload: Record<string, unknown>,
  existing: SpecialBet | undefined,
  setBets: React.Dispatch<React.SetStateAction<Record<string, SpecialBet>>>
) {
  if (existing?.is_locked) { toast.error('Palpite bloqueado'); return }
  if (existing && existing.edit_count >= MAX_EDITS) { toast.error('Limite de edições atingido'); return }

  if (existing) {
    const { data, error } = await supabase
      .from('special_bets')
      .update({ ...payload, edit_count: existing.edit_count + 1 })
      .eq('id', existing.id)
      .select('id, bet_type, team_id, player_id, edit_count, is_locked')
      .single()
    if (error) throw error
    setBets(b => ({ ...b, [key]: data }))
  } else {
    const { data, error } = await supabase
      .from('special_bets')
      .insert({ user_id: userId, bet_type: betType, edit_count: 1, ...payload })
      .select('id, bet_type, team_id, player_id, edit_count, is_locked')
      .single()
    if (error) throw error
    setBets(b => ({ ...b, [key]: data }))
  }
}

function AvisoBloqueio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
      {children}
    </div>
  )
}

function TabCampeao({
  teams,
  userId,
  bets,
  setBets,
  gruposTerminados,
  quartasTerminadas,
}: {
  teams: Team[]
  userId: string
  bets: Record<string, SpecialBet>
  setBets: React.Dispatch<React.SetStateAction<Record<string, SpecialBet>>>
  gruposTerminados: boolean
  quartasTerminadas: boolean
}) {
  const [selected, setSelected] = useState<string | null>(() => bets['champion']?.team_id ?? null)
  const [saving, setSaving] = useState(false)
  const bet = bets['champion']
  const bloqueado = bet?.is_locked || (bet && bet.edit_count >= MAX_EDITS) || gruposTerminados || quartasTerminadas
  const restantes = bet ? MAX_EDITS - bet.edit_count : MAX_EDITS

  useEffect(() => {
    if (bets['champion']?.team_id) setSelected(bets['champion'].team_id)
  }, [bets])

  async function confirmar() {
    if (!selected) { toast.error('Selecione uma seleção'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      await saveBet(supabase, userId, 'champion', 'champion', { team_id: selected }, bet, setBets)
      toast.success('Campeão salvo!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {quartasTerminadas ? (
        <AvisoBloqueio>⚠️ Palpite de campeão encerrado após as quartas de final</AvisoBloqueio>
      ) : gruposTerminados ? (
        <AvisoBloqueio>🔒 Palpites de campeão encerrados — fase de grupos encerrada</AvisoBloqueio>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Selecione o campeão da Copa 2026</p>
        <div className="flex items-center gap-2">
          {bloqueado ? (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueado</Badge>
          ) : (
            <span className="text-xs text-zinc-500">{restantes}x restante{restantes !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {teams.map(t => (
          <button
            key={t.id}
            disabled={!!bloqueado}
            onClick={() => setSelected(t.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors text-center ${
              selected === t.id
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
            }`}
          >
            {t.flag_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.flag_url} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <span className="text-2xl">🏳️</span>
            )}
            <span className="text-xs text-zinc-300 leading-tight">{t.name}</span>
          </button>
        ))}
      </div>
      <Button
        disabled={!!bloqueado || saving}
        onClick={confirmar}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar campeão'}
      </Button>
    </div>
  )
}

function TabArtilheiro({
  players,
  userId,
  bets,
  setBets,
  gruposTerminados,
}: {
  players: Player[]
  userId: string
  bets: Record<string, SpecialBet>
  setBets: React.Dispatch<React.SetStateAction<Record<string, SpecialBet>>>
  gruposTerminados: boolean
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(() => bets['top_scorer']?.player_id ?? null)
  const [saving, setSaving] = useState(false)
  const bet = bets['top_scorer']
  const bloqueado = bet?.is_locked || (bet && bet.edit_count >= MAX_EDITS) || gruposTerminados
  const restantes = bet ? MAX_EDITS - bet.edit_count : MAX_EDITS

  useEffect(() => {
    if (bets['top_scorer']?.player_id) setSelected(bets['top_scorer'].player_id)
  }, [bets])

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.team_name.toLowerCase().includes(query.toLowerCase())
  )

  async function confirmar() {
    if (!selected) { toast.error('Selecione um jogador'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      await saveBet(supabase, userId, 'top_scorer', 'top_scorer', { player_id: selected }, bet, setBets)
      toast.success('Artilheiro salvo!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {gruposTerminados && (
        <AvisoBloqueio>🔒 Palpites de artilheiro da copa encerrados — fase de grupos encerrada</AvisoBloqueio>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Artilheiro da Copa 2026</p>
        {bloqueado ? (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueado</Badge>
        ) : (
          <span className="text-xs text-zinc-500">{restantes}x restante{restantes !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
        <Input
          placeholder="Buscar jogador ou seleção..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-50 h-10"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto space-y-1">
        {filtered.map(p => (
          <button
            key={p.id}
            disabled={!!bloqueado}
            onClick={() => setSelected(p.id)}
            className={`flex items-center gap-3 w-full rounded-lg border px-3 py-2 transition-colors text-left ${
              selected === p.id
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
            }`}
          >
            {p.team_flag ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.team_flag} alt="" className="size-6 rounded-full object-cover" />
            ) : (
              <span className="text-lg">🏳️</span>
            )}
            <div>
              <p className="text-sm font-medium text-zinc-200">{p.name}</p>
              <p className="text-xs text-zinc-500">{p.team_name}</p>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-zinc-500 py-6 text-sm">Nenhum jogador encontrado</p>
        )}
      </div>
      <Button
        disabled={!!bloqueado || saving}
        onClick={confirmar}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar artilheiro'}
      </Button>
    </div>
  )
}

function TabArtilheiroPorSelecao({
  teams,
  players,
  userId,
  bets,
  setBets,
  oitavasIniciadas,
}: {
  teams: Team[]
  players: Player[]
  userId: string
  bets: Record<string, SpecialBet>
  setBets: React.Dispatch<React.SetStateAction<Record<string, SpecialBet>>>
  oitavasIniciadas: boolean
}) {
  const [modalTeam, setModalTeam] = useState<Team | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const preenchidas = teams.filter(t => bets[`team_scorer_${t.id}`]?.player_id).length

  function openModal(team: Team) {
    if (oitavasIniciadas) return
    const cat = `team_scorer_${team.id}`
    setSelectedPlayer(bets[cat]?.player_id ?? null)
    setModalTeam(team)
  }

  async function confirmarSelecao() {
    if (oitavasIniciadas) { toast.error('Bloqueado'); return }
    if (!modalTeam || !selectedPlayer) { toast.error('Selecione um jogador'); return }
    const cat = `team_scorer_${modalTeam.id}`
    const bet = bets[cat]
    if (bet?.is_locked || (bet && bet.edit_count >= MAX_EDITS)) { toast.error('Bloqueado'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      await saveBet(supabase, userId, cat, 'team_scorer', { player_id: selectedPlayer, team_id: modalTeam.id }, bet, setBets)
      toast.success(`Artilheiro de ${modalTeam.name} salvo!`)
      setModalTeam(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const teamPlayers = modalTeam ? players.filter(p => p.team_id === modalTeam.id) : []

  return (
    <div className="space-y-4">
      {oitavasIniciadas && (
        <AvisoBloqueio>
          🔒 Palpites de artilheiro por seleção encerrados após o início das oitavas
        </AvisoBloqueio>
      )}
      <p className="text-sm text-zinc-400">
        {preenchidas}/{teams.length} seleções preenchidas
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {teams.map(t => {
          const cat = `team_scorer_${t.id}`
          const bet = bets[cat]
          const tem = !!bet?.player_id
          const playerName = tem
            ? players.find(p => p.id === bet.player_id)?.name
            : null
          return (
            <button
              key={t.id}
              disabled={oitavasIniciadas}
              onClick={() => openModal(t)}
              className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors text-center disabled:cursor-not-allowed disabled:opacity-50 ${
                tem ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
            >
              {t.is_eliminated && (
                <span className="absolute top-1 right-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/30">
                  Eliminada
                </span>
              )}
              {t.flag_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.flag_url} alt="" className="size-8 rounded-full object-cover" />
              ) : (
                <span className="text-2xl">🏳️</span>
              )}
              <span className="text-xs text-zinc-300 leading-tight">{t.name}</span>
              {playerName && <span className="text-xs text-emerald-400 truncate w-full">{playerName}</span>}
            </button>
          )
        })}
      </div>

      <Dialog open={!!modalTeam} onOpenChange={open => !open && setModalTeam(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50 max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalTeam?.flag_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={modalTeam.flag_url} alt="" className="size-5 rounded-full object-cover" />
              )}
              Artilheiro — {modalTeam?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {teamPlayers.length === 0 ? (
              <p className="text-center text-zinc-500 py-6 text-sm">Nenhum jogador cadastrado</p>
            ) : (
              teamPlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(p.id)}
                  className={`flex items-center gap-2 w-full rounded-lg border px-3 py-2 transition-colors text-left ${
                    selectedPlayer === p.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-sm font-medium text-zinc-200">{p.name}</span>
                </button>
              ))
            )}
          </div>
          <Button
            disabled={saving || !selectedPlayer}
            onClick={confirmarSelecao}
            className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar artilheiro'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function EspeciaisPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [oitavasIniciadas, setOitavasIniciadas] = useState(false)
  const [gruposTerminados, setGruposTerminados] = useState(false)
  const [quartasTerminadas, setQuartasTerminadas] = useState(false)
  const { bets, setBets } = useBets(userId)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      type PlayerRow = {
        id: string
        name: string
        team_id: string
        teams: { name: string; flag_url: string | null } | { name: string; flag_url: string | null }[] | null
      }
      const PAGE_SIZE = 1000
      const playersData: PlayerRow[] = []
      const [{ data: teamsData }, { data: r16FinishedData }, { data: unfinishedGroupData }, { data: sfFinishedData }] = await Promise.all([
        supabase.from('teams').select('id, name, flag_url, is_eliminated').order('name'),
        supabase.from('matches').select('id').in('phase', ['r16', 'qf', 'sf', 'final']).eq('is_finished', true).limit(1),
        supabase.from('matches').select('id').eq('phase', 'groups').eq('is_finished', false).limit(1),
        supabase.from('matches').select('id').in('phase', ['sf', 'final']).eq('is_finished', true).limit(1),
        (async () => {
          for (let from = 0; ; from += PAGE_SIZE) {
            const { data: page } = await supabase
              .from('players')
              .select('id, name, team_id, teams(name, flag_url)')
              .eq('is_active', true)
              .order('name')
              .range(from, from + PAGE_SIZE - 1)
            if (!page) break
            playersData.push(...(page as PlayerRow[]))
            if (page.length < PAGE_SIZE) break
          }
        })(),
      ])

      setOitavasIniciadas(!!r16FinishedData?.length)
      setGruposTerminados(!unfinishedGroupData?.length)
      setQuartasTerminadas(!!sfFinishedData?.length)
      if (teamsData) setTeams(teamsData)
      if (playersData.length) {
        setPlayers(
          playersData.map(p => {
            const t = Array.isArray(p.teams) ? p.teams[0] : p.teams
            return {
              id: p.id,
              name: p.name,
              team_id: p.team_id,
              team_name: t?.name ?? '',
              team_flag: t?.flag_url ?? null,
            }
          })
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  const eliminatedTeamIds = useMemo(
    () => new Set(teams.filter(t => t.is_eliminated).map(t => t.id)),
    [teams]
  )
  const activeTeams = useMemo(() => teams.filter(t => !t.is_eliminated), [teams])
  const activePlayers = useMemo(
    () => players.filter(p => !eliminatedTeamIds.has(p.team_id)),
    [players, eliminatedTeamIds]
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-6">⭐ Palpites Especiais</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : userId ? (
        <Tabs defaultValue="campeao">
          <TabsList className="w-full bg-zinc-900 border border-zinc-800 mb-6">
            <TabsTrigger value="campeao" className="flex-1 data-active:bg-emerald-500 data-active:text-white">
              Campeão
            </TabsTrigger>
            <TabsTrigger value="artilheiro" className="flex-1 data-active:bg-emerald-500 data-active:text-white">
              Artilheiro
            </TabsTrigger>
            <TabsTrigger value="por-selecao" className="flex-1 data-active:bg-emerald-500 data-active:text-white">
              Por Seleção
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campeao">
            <TabCampeao
              teams={activeTeams}
              userId={userId}
              bets={bets}
              setBets={setBets}
              gruposTerminados={gruposTerminados}
              quartasTerminadas={quartasTerminadas}
            />
          </TabsContent>

          <TabsContent value="artilheiro">
            <TabArtilheiro players={activePlayers} userId={userId} bets={bets} setBets={setBets} gruposTerminados={gruposTerminados} />
          </TabsContent>

          <TabsContent value="por-selecao">
            <TabArtilheiroPorSelecao
              teams={teams}
              players={players}
              userId={userId}
              bets={bets}
              setBets={setBets}
              oitavasIniciadas={oitavasIniciadas}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
