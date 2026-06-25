import { NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { dateBrasilia } from '@/lib/zafronix'
import { syncResultados } from '@/lib/sync/resultados'
import { syncArtilharia } from '@/lib/sync/artilharia'
import { syncGrupos } from '@/lib/sync/grupos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const THIRTY_MIN_MS = 30 * 60 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

type AdminClient = ReturnType<typeof createAdminClient>

async function runAllSyncs(supabase: AdminClient, configId: string | undefined) {
  try {
    const [resultados, artilharia, grupos] = await Promise.all([
      syncResultados(supabase).catch(err => {
        console.error('cron/sync resultados error:', err)
        return { error: err instanceof Error ? err.message : 'Falha ao sincronizar resultados' }
      }),
      syncArtilharia(supabase).catch(err => {
        console.error('cron/sync artilharia error:', err)
        return { error: err instanceof Error ? err.message : 'Falha ao sincronizar artilharia' }
      }),
      syncGrupos(supabase).catch(err => {
        console.error('cron/sync grupos error:', err)
        return { error: err instanceof Error ? err.message : 'Falha ao sincronizar grupos' }
      }),
    ])

    const timestamp = new Date().toISOString()
    if (configId) {
      await supabase.from('score_config').update({ last_sync: timestamp }).eq('id', configId)
    }

    console.log('cron/sync background concluído:', { timestamp, resultados, artilharia, grupos })
  } catch (err: unknown) {
    console.error('cron/sync background error:', err)
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const today = dateBrasilia(new Date())
    const dayStart = `${today}T00:00:00-03:00`
    const dayEnd = `${today}T23:59:59-03:00`

    const { count: gamesToday } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('is_finished', false)
      .gte('kickoff_at', dayStart)
      .lte('kickoff_at', dayEnd)

    const { data: config } = await supabase
      .from('score_config')
      .select('id, last_sync')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    const sinceLastSync = config?.last_sync
      ? Date.now() - new Date(config.last_sync).getTime()
      : Infinity

    const hasGamesToday = (gamesToday ?? 0) > 0

    // Cache fresh: dados sincronizados há menos de 30 min, não chama a API.
    if (sinceLastSync < THIRTY_MIN_MS) {
      return Response.json({
        success: true,
        skipped: 'cache_fresh',
        games_today: gamesToday ?? 0,
      })
    }

    // Sem jogos hoje: só sincroniza a cada 2h, mesmo que o cron rode mais vezes.
    if (!hasGamesToday && sinceLastSync < TWO_HOURS_MS) {
      return Response.json({
        success: true,
        skipped: 'no_games_today',
        games_today: 0,
      })
    }

    // Dispara o sync em background e responde imediatamente, para o
    // cron-job.org não estourar timeout esperando a API do Zafronix.
    waitUntil(runAllSyncs(supabase, config?.id))

    return Response.json({
      success: true,
      message: 'sync iniciado',
      games_today: gamesToday ?? 0,
    })
  } catch (err: unknown) {
    console.error('cron/sync error:', err)
    const message = err instanceof Error ? err.message : 'Falha ao executar sincronização'
    return Response.json({ error: message }, { status: 500 })
  }
}
