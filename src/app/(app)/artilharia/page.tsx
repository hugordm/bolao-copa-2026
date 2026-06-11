'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

type Time = { name: string; flag_url: string | null }

type Artilheiro = {
  id: string
  name: string
  goals_in_tournament: number
  team: Time
}

function singleOrFirst<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function Flag({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) return <span className="text-lg">🏳️</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-5 rounded-full object-cover" />
}

const SELECT_CLASS =
  'h-9 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 text-sm text-zinc-50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

const DESTAQUE_POSICAO: Record<number, string> = {
  0: 'border-l-4 border-l-yellow-400 bg-yellow-400/5',
  1: 'border-l-4 border-l-zinc-300 bg-zinc-300/5',
  2: 'border-l-4 border-l-amber-700 bg-amber-700/5',
}

const MEDALHA: Record<number, string> = {
  0: '🥇',
  1: '🥈',
  2: '🥉',
}

export default function ArtilhariaPage() {
  const [artilheiros, setArtilheiros] = useState<Artilheiro[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState('')

  const fetchArtilharia = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('players')
      .select('id, name, goals_in_tournament, team:teams(name, flag_url)')
      .gt('goals_in_tournament', 0)
      .order('goals_in_tournament', { ascending: false })
      .order('name', { ascending: true })

    if (data) {
      setArtilheiros(
        data.map((p): Artilheiro => ({
          id: p.id,
          name: p.name,
          goals_in_tournament: p.goals_in_tournament,
          team: singleOrFirst<Time>(p.team) ?? { name: '?', flag_url: null },
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchArtilharia()

    const supabase = createClient()
    const channel = supabase
      .channel('artilharia-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchArtilharia)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchArtilharia])

  const selecoes = useMemo(() => {
    const map = new Map<string, Time>()
    for (const a of artilheiros) map.set(a.team.name, a.team)
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [artilheiros])

  const posicaoPorId = useMemo(() => {
    const map = new Map<string, number>()
    artilheiros.forEach((a, i) => map.set(a.id, i))
    return map
  }, [artilheiros])

  const filtrados = teamFilter ? artilheiros.filter(a => a.team.name === teamFilter) : artilheiros

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-1">⚽ Artilharia da Copa 2026</h1>
      <p className="mb-4 text-sm text-zinc-500">Os goleadores do torneio</p>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 rounded-lg bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : artilheiros.length === 0 ? (
        <p className="text-center text-zinc-500 py-12">Nenhum gol marcado ainda</p>
      ) : (
        <>
          <div className="mb-4">
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className={SELECT_CLASS}>
              <option value="">Todas as seleções</option>
              {selecoes.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {filtrados.length === 0 ? (
            <p className="text-center text-zinc-500 py-12">Nenhum gol marcado por essa seleção</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3 w-14">Pos.</th>
                    <th className="px-4 py-3">Jogador</th>
                    <th className="px-4 py-3">Seleção</th>
                    <th className="px-4 py-3 text-right">Gols</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-900/40">
                  {filtrados.map(a => {
                    const pos = posicaoPorId.get(a.id) ?? 0
                    return (
                      <motion.tr
                        key={a.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={DESTAQUE_POSICAO[pos] ?? ''}
                      >
                        <td className="px-4 py-3 font-bold text-zinc-300">
                          {MEDALHA[pos] ?? `${pos + 1}º`}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-100">{a.name}</td>
                        <td className="px-4 py-3 text-zinc-300">
                          <div className="flex items-center gap-2">
                            <Flag url={a.team.flag_url} alt="" />
                            <span className="truncate">{a.team.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-zinc-50 tabular-nums">
                          {a.goals_in_tournament}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
