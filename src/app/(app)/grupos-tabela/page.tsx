'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { selecionarMelhoresTerceiros } from '@/lib/scoring'

type Time = { name: string; flag_url: string | null }

type StandingRow = {
  team_id: string
  team: Time
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goal_difference: number
  points: number
  position: number
  is_best_third: boolean
}

type Grupo = {
  name: string
  teams: StandingRow[]
}

function Flag({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) return <span className="text-base">🏳️</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-5 rounded-full object-cover shrink-0" />
}

/** Orders a group's teams by their stored `position` (1..N) when it's a valid
 * permutation, otherwise falls back to points -> goal difference -> goals for. */
function ordenarGrupo(teams: StandingRow[]): StandingRow[] {
  const positions = teams.map(t => t.position)
  const validas =
    positions.every(p => p >= 1 && p <= teams.length) &&
    new Set(positions).size === teams.length

  if (validas) {
    return [...teams].sort((a, b) => a.position - b.position)
  }
  return [...teams].sort(
    (a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for
  )
}

export default function GruposTabelaPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [groupStageFinished, setGroupStageFinished] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchStandings = useCallback(async () => {
    const supabase = createClient()
    const [{ data: teamsData }, { data: standingsData }, { data: matchesData }] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, flag_url, group_name')
        .not('group_name', 'is', null)
        .order('group_name', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('group_standings')
        .select('team_id, played, won, drawn, lost, goals_for, goal_difference, points, position, is_best_third'),
      supabase.from('matches').select('is_finished').eq('phase', 'groups'),
    ])

    type StandingData = {
      team_id: string
      played: number
      won: number
      drawn: number
      lost: number
      goals_for: number
      goal_difference: number
      points: number
      position: number
      is_best_third: boolean
    }
    const standingsMap = new Map<string, StandingData>(
      (standingsData ?? []).map((s: StandingData) => [s.team_id, s])
    )

    const groupMap = new Map<string, StandingRow[]>()
    for (const t of teamsData ?? []) {
      if (!t.group_name) continue
      const s = standingsMap.get(t.id)
      const row: StandingRow = {
        team_id: t.id,
        team: { name: t.name, flag_url: t.flag_url },
        played: s?.played ?? 0,
        won: s?.won ?? 0,
        drawn: s?.drawn ?? 0,
        lost: s?.lost ?? 0,
        goals_for: s?.goals_for ?? 0,
        goal_difference: s?.goal_difference ?? 0,
        points: s?.points ?? 0,
        position: s?.position ?? 0,
        is_best_third: s?.is_best_third ?? false,
      }
      const list = groupMap.get(t.group_name) ?? []
      list.push(row)
      groupMap.set(t.group_name, list)
    }

    const gruposList: Grupo[] = Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, teams]) => ({ name, teams: ordenarGrupo(teams) }))

    const groupMatches = matchesData ?? []
    setGroupStageFinished(groupMatches.length > 0 && groupMatches.every(m => m.is_finished))
    setGrupos(gruposList)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStandings()

    const supabase = createClient()
    const channel = supabase
      .channel('grupos-tabela-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_standings' }, fetchStandings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchStandings)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchStandings])

  // 8 melhores terceiros (apenas relevante quando a fase de grupos termina)
  const thirdPlacedByGroup = grupos
    .map(g => g.teams[2])
    .filter((t): t is StandingRow => !!t)
  const bestThirdIds = groupStageFinished ? selecionarMelhoresTerceiros(thirdPlacedByGroup) : new Set<string>()

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-1">📊 Tabela dos Grupos</h1>
      <p className="mb-4 text-sm text-zinc-500">Classificação dos grupos da Copa</p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <p className="text-center text-zinc-500 py-12">Nenhum grupo encontrado</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos.map(g => (
            <div key={g.name} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 px-4 py-3">
                <h3 className="font-bold text-zinc-50">Grupo {g.name}</h3>
              </div>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2">Time</th>
                    <th className="w-[24px] px-1 py-2 text-center">J</th>
                    <th className="w-[24px] px-1 py-2 text-center">V</th>
                    <th className="w-[24px] px-1 py-2 text-center">E</th>
                    <th className="w-[24px] px-1 py-2 text-center">D</th>
                    <th className="w-[24px] px-1 py-2 text-center">SG</th>
                    <th className="w-[24px] px-1 py-2 text-center">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {g.teams.map((t, idx) => {
                    let rowClass = ''
                    let badge: { text: string; className: string } | null = null

                    if (!groupStageFinished) {
                      if (idx === 0 || idx === 1) {
                        rowClass = 'bg-emerald-500/5'
                      } else if (idx === 2) {
                        rowClass = 'bg-yellow-900/40 border-l-2 border-yellow-500'
                        badge = { text: '❓ Possível', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' }
                      } else if (idx === 3) {
                        rowClass = 'bg-red-900/40 border-l-2 border-red-500'
                        badge = { text: '✗ Eliminado', className: 'bg-red-500/10 text-red-400 border-red-500/20' }
                      }
                    } else {
                      const classificado = idx === 0 || idx === 1 || (idx === 2 && bestThirdIds.has(t.team_id))
                      if (classificado) {
                        rowClass = 'bg-emerald-900/40 border-l-2 border-emerald-500'
                        badge = { text: '✓ Classificado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
                      } else {
                        rowClass = 'bg-red-900/40 border-l-2 border-red-500'
                        badge = { text: '✗ Eliminado', className: 'bg-red-500/10 text-red-400 border-red-500/20' }
                      }
                    }

                    return (
                      <motion.tr
                        key={t.team_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className={rowClass}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Flag url={t.team.flag_url} alt="" />
                            <span className="flex-1 min-w-0 truncate font-medium text-zinc-100">{t.team.name}</span>
                            {badge && (
                              <Badge className={`shrink-0 px-1.5 py-0 text-[10px] ${badge.className}`}>{badge.text}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="w-[24px] px-1 py-2 text-center tabular-nums text-zinc-300">{t.played}</td>
                        <td className="w-[24px] px-1 py-2 text-center tabular-nums text-zinc-300">{t.won}</td>
                        <td className="w-[24px] px-1 py-2 text-center tabular-nums text-zinc-300">{t.drawn}</td>
                        <td className="w-[24px] px-1 py-2 text-center tabular-nums text-zinc-300">{t.lost}</td>
                        <td className="w-[24px] px-1 py-2 text-center tabular-nums text-zinc-300">{t.goal_difference}</td>
                        <td className="w-[24px] px-1 py-2 text-center font-bold tabular-nums text-zinc-50">{t.points}</td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
