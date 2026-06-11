'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Selecao = {
  id: string
  name: string
  flag_url: string | null
}

type Grupo = {
  name: string
  teams: Selecao[]
}

type GroupBet = {
  id: string
  group_name: string
  team_1st_id: string
  team_2nd_id: string
  team_3rd_id: string
  team_4th_id: string
  edit_count: number
}

const MAX_EDITS = 3

function SortableTeam({
  team,
  selected,
  disabled,
  onSelect,
}: {
  team: Selecao
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: team.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={disabled ? undefined : onSelect}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
        disabled
          ? 'cursor-not-allowed border-zinc-700 bg-zinc-800 opacity-60'
          : selected
            ? 'cursor-pointer border-emerald-500 bg-emerald-500/10 animate-pulse'
            : 'cursor-pointer border-zinc-700 bg-zinc-800 hover:border-zinc-600'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        onClick={e => e.stopPropagation()}
        className="cursor-grab text-zinc-500 hover:text-zinc-300 touch-none disabled:cursor-not-allowed"
      >
        <GripVertical className="size-4" />
      </button>
      {team.flag_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.flag_url} alt="" className="size-5 rounded-full object-cover" />
      ) : (
        <span className="text-base">🏳️</span>
      )}
      <span className="text-sm font-medium text-zinc-200">{team.name}</span>
    </div>
  )
}

function GrupoCard({
  grupo,
  bet,
  userId,
  onSaved,
  terceiraRodadaIniciada,
}: {
  grupo: Grupo
  bet: GroupBet | null
  userId: string
  onSaved: (bet: GroupBet) => void
  terceiraRodadaIniciada: boolean
}) {
  const [teams, setTeams] = useState<Selecao[]>(() => {
    if (bet) {
      const orderedIds = [bet.team_1st_id, bet.team_2nd_id, bet.team_3rd_id, bet.team_4th_id]
      const ordered = orderedIds
        .map(id => grupo.teams.find(t => t.id === id))
        .filter((t): t is Selecao => !!t)
      const rest = grupo.teams.filter(t => !ordered.find(o => o.id === t.id))
      return [...ordered, ...rest]
    }
    return grupo.teams
  })
  const [saving, setSaving] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const bloqueado = (bet && bet.edit_count >= MAX_EDITS) || terceiraRodadaIniciada
  const editesRestantes = bet ? MAX_EDITS - bet.edit_count : MAX_EDITS
  const incompleto = grupo.teams.length < 4

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTeams(prev => {
      const oldIndex = prev.findIndex(t => t.id === active.id)
      const newIndex = prev.findIndex(t => t.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function handleSelectTeam(teamId: string) {
    if (selectedTeamId === null) {
      setSelectedTeamId(teamId)
    } else if (selectedTeamId === teamId) {
      setSelectedTeamId(null)
    } else {
      const fromId = selectedTeamId
      setTeams(prev => {
        const idx1 = prev.findIndex(t => t.id === fromId)
        const idx2 = prev.findIndex(t => t.id === teamId)
        if (idx1 === -1 || idx2 === -1) return prev
        const next = [...prev]
        ;[next[idx1], next[idx2]] = [next[idx2], next[idx1]]
        return next
      })
      setSelectedTeamId(null)
    }
  }

  async function salvar() {
    if (bloqueado || incompleto) return
    setSaving(true)
    try {
      const supabase = createClient()
      const [team1, team2, team3, team4] = teams.map(t => t.id)
      if (bet) {
        const { data, error } = await supabase
          .from('group_order_bets')
          .update({
            team_1st_id: team1,
            team_2nd_id: team2,
            team_3rd_id: team3,
            team_4th_id: team4,
            edit_count: bet.edit_count + 1,
          })
          .eq('id', bet.id)
          .select('id, group_name, team_1st_id, team_2nd_id, team_3rd_id, team_4th_id, edit_count')
          .single()
        if (error) throw error
        onSaved(data)
      } else {
        const { data, error } = await supabase
          .from('group_order_bets')
          .insert({
            user_id: userId,
            group_name: grupo.name,
            team_1st_id: team1,
            team_2nd_id: team2,
            team_3rd_id: team3,
            team_4th_id: team4,
            edit_count: 1,
          })
          .select('id, group_name, team_1st_id, team_2nd_id, team_3rd_id, team_4th_id, edit_count')
          .single()
        if (error) throw error
        onSaved(data)
      }
      toast.success(`Grupo ${grupo.name} salvo!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-zinc-50">Grupo {grupo.name}</h3>
        <div className="flex items-center gap-2">
          {terceiraRodadaIniciada ? (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              🔒 3ª rodada iniciada — ordem bloqueada
            </Badge>
          ) : bloqueado ? (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueado</Badge>
          ) : (
            <span className="text-xs text-zinc-500">{editesRestantes}x restante{editesRestantes !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {!bloqueado && (
        <p className="mb-2 text-xs text-zinc-500">
          Clique em dois times para trocar de posição, ou arraste para reordenar
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={teams.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5 mb-3">
            {teams.map((team, idx) => (
              <div key={team.id} className="flex items-center gap-2">
                <span className="w-5 text-xs text-zinc-600 font-bold">{idx + 1}º</span>
                <div className="flex-1">
                  <SortableTeam
                    team={team}
                    selected={selectedTeamId === team.id}
                    disabled={!!bloqueado}
                    onSelect={() => handleSelectTeam(team.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        size="sm"
        disabled={!!bloqueado || incompleto || saving}
        onClick={salvar}
        className="bg-emerald-500 hover:bg-emerald-600 text-white w-full"
      >
        {saving ? <Loader2 className="size-3 animate-spin" /> : incompleto ? 'Aguardando seleções' : 'Salvar ordem'}
      </Button>
    </div>
  )
}

export default function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [bets, setBets] = useState<Record<string, GroupBet>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [terceiraRodada, setTerceiraRodada] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: teamsData }, { data: betData }, { data: groupMatchesData }] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, flag_url, group_name')
          .order('group_name', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('group_order_bets')
          .select('id, group_name, team_1st_id, team_2nd_id, team_3rd_id, team_4th_id, edit_count')
          .eq('user_id', user.id),
        supabase
          .from('matches')
          .select('group_name, kickoff_at')
          .eq('phase', 'groups')
          .order('kickoff_at', { ascending: true }),
      ])

      const now = Date.now()
      const matchesPorGrupo = new Map<string, string[]>()
      for (const m of groupMatchesData ?? []) {
        if (!m.group_name) continue
        const list = matchesPorGrupo.get(m.group_name) ?? []
        list.push(m.kickoff_at)
        matchesPorGrupo.set(m.group_name, list)
      }
      const terceiraRodadaMap: Record<string, boolean> = {}
      for (const [groupName, kickoffs] of matchesPorGrupo) {
        const terceiroJogo = kickoffs[2]
        terceiraRodadaMap[groupName] = !!terceiroJogo && new Date(terceiroJogo).getTime() <= now
      }
      setTerceiraRodada(terceiraRodadaMap)

      const groupMap = new Map<string, Selecao[]>()
      for (const t of teamsData ?? []) {
        if (!t.group_name) continue
        const list = groupMap.get(t.group_name) ?? []
        list.push({ id: t.id, name: t.name, flag_url: t.flag_url })
        groupMap.set(t.group_name, list)
      }

      const gruposList: Grupo[] = Array.from(groupMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, teams]) => ({ name, teams }))

      setGrupos(gruposList)

      const betMap: Record<string, GroupBet> = {}
      for (const b of betData ?? []) betMap[b.group_name] = b
      setBets(betMap)
      setLoading(false)
    }
    load()
  }, [])

  function handleSaved(bet: GroupBet) {
    setBets(b => ({ ...b, [bet.group_name]: bet }))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-6">🏆 Palpites de Grupos</h1>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <p className="text-center text-zinc-500 py-12">Nenhum grupo encontrado</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {grupos.map(g => (
            <GrupoCard
              key={g.name}
              grupo={g}
              bet={bets[g.name] ?? null}
              userId={userId ?? ''}
              onSaved={handleSaved}
              terceiraRodadaIniciada={terceiraRodada[g.name] ?? false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
