'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, RotateCcw, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ScoreConfig = {
  pts_exact_score: number
  pts_correct_result: number
  pts_group_1st: number
  pts_group_order_partial: number
  pts_group_order_exact: number
  pts_champion: number
  pts_top_scorer: number
  pts_team_scorer: number
}

const DEFAULT_CONFIG: ScoreConfig = {
  pts_exact_score: 3,
  pts_correct_result: 1,
  pts_group_1st: 5,
  pts_group_order_partial: 1,
  pts_group_order_exact: 3,
  pts_champion: 10,
  pts_top_scorer: 8,
  pts_team_scorer: 5,
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
      {children}
    </h2>
  )
}

function PontosBadge({ pontos }: { pontos: number }) {
  const positivo = pontos > 0
  return (
    <div className="shrink-0 text-right">
      <p className={`text-xl font-black ${positivo ? 'text-emerald-400' : 'text-zinc-500'}`}>
        {positivo ? `+${pontos}` : pontos}
      </p>
      <p className="text-xs text-zinc-500">{pontos === 1 ? 'ponto' : 'pontos'}</p>
    </div>
  )
}

function RegraCard({
  icon,
  title,
  description,
  pontos,
  index,
}: {
  icon: string
  title: string
  description: string
  pontos: number
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4"
    >
      <span className="text-4xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-zinc-50">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
      </div>
      <PontosBadge pontos={pontos} />
    </motion.div>
  )
}

export default function PontuacaoPage() {
  const [config, setConfig] = useState<ScoreConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('score_config')
      .select(
        'pts_exact_score, pts_correct_result, pts_group_1st, pts_group_order_partial, pts_group_order_exact, pts_champion, pts_top_scorer, pts_team_scorer'
      )
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data)
      })
  }, [])

  const exemploExatos = 10 * config.pts_exact_score
  const exemploTotal = exemploExatos + config.pts_champion + config.pts_top_scorer

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-zinc-50">Como funciona a pontuação 🏆</h1>
        <p className="mt-1 text-sm text-zinc-400">Entenda como ganhar pontos no bolão</p>
      </div>

      <section>
        <SectionTitle>Palpites de Placar</SectionTitle>
        <div className="space-y-3">
          <RegraCard
            index={0}
            icon="🎯"
            title="Placar exato"
            description="Você acertou o placar cravado (ex: palpitou 2x1, terminou 2x1)"
            pontos={config.pts_exact_score}
          />
          <RegraCard
            index={1}
            icon="✅"
            title="Resultado certo"
            description="Você acertou quem venceu (ou o empate), mas não o placar (ex: palpitou 2x1, terminou 1x0, Brasil ganhou nos dois)"
            pontos={config.pts_correct_result}
          />
          <RegraCard
            index={2}
            icon="❌"
            title="Errou tudo"
            description="O resultado palpitado não correspondeu ao que aconteceu na partida"
            pontos={0}
          />
        </div>
      </section>

      <section>
        <SectionTitle>Classificação dos Grupos</SectionTitle>
        <div className="space-y-3">
          <RegraCard
            index={3}
            icon="🥇"
            title="1º colocado do grupo"
            description="Acertou qual seleção termina o grupo na 1ª colocação"
            pontos={config.pts_group_1st}
          />
          <RegraCard
            index={4}
            icon="🥈"
            title="1º e 2º na ordem certa"
            description="Acertou as seleções do 1º e 2º lugar do grupo, na ordem exata"
            pontos={config.pts_group_order_partial}
          />
          <RegraCard
            index={5}
            icon="🏆"
            title="Ordem exata (1º ao 4º)"
            description="Acertou a classificação completa do grupo, do 1º ao 4º colocado"
            pontos={config.pts_group_order_exact}
          />
        </div>
      </section>

      <section>
        <SectionTitle>Palpites Especiais</SectionTitle>
        <div className="space-y-3">
          <RegraCard
            index={6}
            icon="🏆"
            title="Campeão da copa"
            description="Acertou a seleção que vai levantar a taça"
            pontos={config.pts_champion}
          />
          <RegraCard
            index={7}
            icon="⚽"
            title="Artilheiro da copa"
            description="Acertou o jogador que termina como maior artilheiro do mundial"
            pontos={config.pts_top_scorer}
          />
          <RegraCard
            index={8}
            icon="🎯"
            title="Artilheiro de cada seleção"
            description="Acertou o artilheiro de uma seleção específica (apurado quando ela é eliminada)"
            pontos={config.pts_team_scorer}
          />
        </div>
      </section>

      <section>
        <SectionTitle>Regras importantes</SectionTitle>
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 9 * 0.05, duration: 0.3 }}
            className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
          >
            <Clock className="size-5 shrink-0 mt-0.5 text-zinc-400" />
            <p className="text-sm text-zinc-300">
              <span className="font-semibold text-zinc-50">Prazo de palpite:</span> fecha 5 minutos antes do apito inicial da partida
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 10 * 0.05, duration: 0.3 }}
            className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
          >
            <RotateCcw className="size-5 shrink-0 mt-0.5 text-zinc-400" />
            <p className="text-sm text-zinc-300">
              <span className="font-semibold text-zinc-50">Alterações:</span> máximo de 3 alterações por palpite
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 11 * 0.05, duration: 0.3 }}
            className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
          >
            <Lock className="size-5 shrink-0 mt-0.5 text-zinc-400" />
            <p className="text-sm text-zinc-300">
              <span className="font-semibold text-zinc-50">Palpites especiais:</span> fecham antes do 1º jogo da copa
            </p>
          </motion.div>
        </div>
      </section>

      <section>
        <SectionTitle>Exemplo prático</SectionTitle>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 12 * 0.05, duration: 0.3 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-4"
        >
          <p className="text-sm text-zinc-300">
            Se você acertar <span className="font-semibold text-zinc-50">10 placares exatos</span> +{' '}
            <span className="font-semibold text-zinc-50">o campeão</span> +{' '}
            <span className="font-semibold text-zinc-50">o artilheiro da copa</span>:
          </p>
          <div className="mt-3 space-y-1 text-sm text-zinc-400">
            <p>
              10 × {config.pts_exact_score} = <span className="text-emerald-400 font-semibold">{exemploExatos} pts</span> (placares exatos)
            </p>
            <p>
              + <span className="text-emerald-400 font-semibold">{config.pts_champion} pts</span> (campeão)
            </p>
            <p>
              + <span className="text-emerald-400 font-semibold">{config.pts_top_scorer} pts</span> (artilheiro)
            </p>
          </div>
          <div className="mt-3 border-t border-emerald-500/20 pt-3">
            <p className="text-lg font-black text-emerald-400">= {exemploTotal} pontos</p>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
