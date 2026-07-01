'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

type Participante = {
  id: string
  name: string
  avatar_url: string | null
  total_points: number
}

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-blue-600', 'bg-violet-600', 'bg-orange-600',
  'bg-pink-600', 'bg-cyan-600', 'bg-yellow-600', 'bg-red-600',
]

function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function useContagem() {
  const [texto, setTexto] = useState('')
  useEffect(() => {
    function calcular() {
      const copa = new Date('2026-06-11T12:00:00-03:00')
      const diff = copa.getTime() - Date.now()
      if (diff <= 0) { setTexto('A Copa começou! ⚽'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTexto(`${d}d ${h}h ${m}m ${s}s`)
    }
    calcular()
    const id = setInterval(calcular, 1000)
    return () => clearInterval(id)
  }, [])
  return texto
}

const RANKING_QUERY = `
  SELECT u.id, u.name, u.avatar_url,
    COALESCE(SUM(b.points_earned), 0) +
    COALESCE(SUM(gob.points_earned), 0) +
    COALESCE(SUM(sb.points_earned), 0) AS total_points
  FROM users u
  LEFT JOIN bets b ON b.user_id = u.id
  LEFT JOIN group_order_bets gob ON gob.user_id = u.id
  LEFT JOIN special_bets sb ON sb.user_id = u.id
  GROUP BY u.id, u.name, u.avatar_url
  ORDER BY total_points DESC
`

export default function CompetidoresPage() {
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalEncerrada, setFinalEncerrada] = useState(false)
  const contagem = useContagem()

  const fetchRanking = useCallback(async () => {
    const supabase = createClient()
    const [rpcResult, { data: finalData }] = await Promise.all([
      supabase.rpc('get_ranking_completo'),
      supabase.from('matches').select('id').eq('phase', 'final').eq('is_finished', true).limit(1),
    ])
    const data = rpcResult.data as Participante[] | null

    setFinalEncerrada((finalData ?? []).length > 0)

    if (data) {
      setParticipantes(data)
    } else {
      // fallback: query direta
      const { data: raw } = await supabase.from('users').select(`
        id, name, avatar_url,
        bets(points_earned),
        group_order_bets(points_earned),
        special_bets(points_earned)
      `)
      if (raw) {
        const mapped = raw.map((u: {
          id: string
          name: string
          avatar_url: string | null
          bets?: Array<{ points_earned: number }>
          group_order_bets?: Array<{ points_earned: number }>
          special_bets?: Array<{ points_earned: number }>
        }) => ({
          id: u.id,
          name: u.name,
          avatar_url: u.avatar_url,
          total_points:
            (u.bets ?? []).reduce((s: number, b: { points_earned: number }) => s + (b.points_earned ?? 0), 0) +
            (u.group_order_bets ?? []).reduce((s: number, b: { points_earned: number }) => s + (b.points_earned ?? 0), 0) +
            (u.special_bets ?? []).reduce((s: number, b: { points_earned: number }) => s + (b.points_earned ?? 0), 0),
        }))
        mapped.sort((a: Participante, b: Participante) => b.total_points - a.total_points)
        setParticipantes(mapped)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))

    fetchRanking()

    const channel = supabase
      .channel('competidores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchRanking)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, fetchRanking)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_order_bets' }, fetchRanking)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_bets' }, fetchRanking)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, fetchRanking)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchRanking])

  const medalha = (i: number) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-zinc-50">🏆 Bolão da Copa 2026</h1>
        {finalEncerrada ? (
          <p className="mt-1 text-sm font-semibold text-yellow-400">
            🏆 Fim de jogo! Confira o resultado final!
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">
            Copa começa em: <span className="font-mono font-bold text-emerald-400">{contagem}</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {participantes.map((p, i) => {
            const isLeader = i === 0
            const isMe = p.id === currentUserId
            const isCampeao = isLeader && finalEncerrada
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`relative flex items-center gap-4 rounded-xl border px-4 py-3 ${
                  isCampeao
                    ? 'border-yellow-400 bg-yellow-500/10 shadow-[0_0_24px_rgba(234,179,8,0.25)]'
                    : isLeader
                    ? 'border-yellow-500/50 bg-yellow-500/5'
                    : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                {/* Posição */}
                <span className="text-xl w-8 text-center shrink-0">{medalha(i)}</span>

                {/* Avatar */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-white text-base ${avatarColor(p.name)}`}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>

                {/* Nome + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold truncate ${isCampeao ? 'text-yellow-300' : 'text-zinc-50'}`}>
                      {p.name}
                    </span>
                    {isCampeao ? (
                      <motion.span
                        animate={{ scale: [1, 1.08, 1], opacity: [1, 0.8, 1] }}
                        transition={{ repeat: Infinity, duration: 1.8 }}
                        className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-zinc-900"
                      >
                        🏆 Campeão do Bolão
                      </motion.span>
                    ) : isLeader ? (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white"
                      >
                        LÍDER
                      </motion.span>
                    ) : null}
                    {isMe && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                        VOCÊ
                      </span>
                    )}
                  </div>
                </div>

                {/* Pontuação */}
                <div className="text-right shrink-0">
                  <p className={`text-lg font-black ${isCampeao ? 'text-yellow-300' : 'text-zinc-50'}`}>
                    {p.total_points}
                  </p>
                  <p className="text-xs text-zinc-500">pontos</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
