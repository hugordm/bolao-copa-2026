'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Time = {
  name: string
  logo: string | null
}

type Jogo = {
  id: string
  home_team: Time
  away_team: Time
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  is_finished: boolean
  is_live: boolean
  phase: string
  group: string | null
}

type PosicaoData = {
  position: number
  total_points: number
  leader_points: number
}

function formatHora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function JogoCard({ jogo }: { jogo: Jogo }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {jogo.home_team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={jogo.home_team.logo} alt="" className="size-6 shrink-0 rounded-full object-cover" />
        )}
        <span className="text-sm font-semibold text-zinc-100 truncate">{jogo.home_team.name}</span>
      </div>

      <div className="shrink-0 text-center">
        {jogo.is_live && (
          <span className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-red-400">
            <span className="size-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
            AO VIVO
          </span>
        )}
        {jogo.is_finished ? (
          <span className="text-base font-bold text-zinc-50">
            {jogo.home_score} – {jogo.away_score}
          </span>
        ) : (
          <span className="text-sm text-zinc-400">{jogo.kickoff_at ? formatHora(jogo.kickoff_at) : '--:--'}</span>
        )}
        <p className="text-xs text-zinc-500 mt-0.5">{jogo.phase}{jogo.group ? ` · Gr.${jogo.group}` : ''}</p>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-sm font-semibold text-zinc-100 truncate">{jogo.away_team.name}</span>
        {jogo.away_team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={jogo.away_team.logo} alt="" className="size-6 shrink-0 rounded-full object-cover" />
        )}
      </div>
    </div>
  )
}

function SecaoJogos({ titulo, jogos, loading }: { titulo: string; jogos: Jogo[]; loading: boolean }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">{titulo}</h2>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : jogos.length === 0 ? (
        <p className="text-sm text-zinc-500 py-4 text-center">Nenhum jogo</p>
      ) : (
        <div className="space-y-2">
          {jogos.map(j => <JogoCard key={j.id} jogo={j} />)}
        </div>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const [hoje, setHoje] = useState<Jogo[]>([])
  const [amanha, setAmanha] = useState<Jogo[]>([])
  const [loadingJogos, setLoadingJogos] = useState(true)
  const [posicao, setPosicao] = useState<PosicaoData | null>(null)

  useEffect(() => {
    async function fetchJogos() {
      setLoadingJogos(true)
      try {
        const [rHoje, rAmanha] = await Promise.all([
          fetch('/api/jogos/hoje').then(r => r.json()),
          fetch('/api/jogos/amanha').then(r => r.json()),
        ])
        setHoje(Array.isArray(rHoje) ? rHoje : [])
        setAmanha(Array.isArray(rAmanha) ? rAmanha : [])
      } catch {
        setHoje([])
        setAmanha([])
      } finally {
        setLoadingJogos(false)
      }
    }

    async function fetchPosicao() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase.rpc('get_ranking')
        if (!data) return

        const ranking: Array<{ user_id: string; total_points: number }> = data
        const myPos = ranking.findIndex((r) => r.user_id === user.id)
        if (myPos === -1) return

        setPosicao({
          position: myPos + 1,
          total_points: ranking[myPos].total_points,
          leader_points: ranking[0]?.total_points ?? 0,
        })
      } catch {
        // posição indisponível
      }
    }

    fetchJogos()
    fetchPosicao()
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {posicao && (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">Minha posição</p>
          <div className="flex items-end gap-4">
            <p className="text-4xl font-black text-zinc-50">{posicao.position}º</p>
            <div className="mb-1">
              <p className="text-sm text-zinc-300">
                <span className="font-bold text-zinc-50">{posicao.total_points}</span> pontos
              </p>
              {posicao.position > 1 && (
                <p className="text-xs text-zinc-400">
                  {posicao.leader_points - posicao.total_points} pts atrás do líder
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <SecaoJogos titulo="Jogos de Hoje" jogos={hoje} loading={loadingJogos} />
      <SecaoJogos titulo="Jogos de Amanhã" jogos={amanha} loading={loadingJogos} />
    </div>
  )
}
