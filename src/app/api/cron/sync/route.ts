import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { dateBrasilia } from '@/lib/zafronix'
import { syncResultados } from '@/lib/sync/resultados'
import { syncArtilharia } from '@/lib/sync/artilharia'
import { syncGrupos } from '@/lib/sync/grupos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FIVE_MIN_MS = 5 * 60 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

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

    // Cache fresh: dados sincronizados há menos de 5 min, não chama a API.
    if (sinceLastSync < FIVE_MIN_MS) {
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

    const resultados = await syncResultados(supabase)
    const artilharia = await syncArtilharia(supabase)
    const grupos = await syncGrupos(supabase)

    const timestamp = new Date().toISOString()
    if (config?.id) {
      await supabase.from('score_config').update({ last_sync: timestamp }).eq('id', config.id)
    }

    return Response.json({
      success: true,
      timestamp,
      games_today: gamesToday ?? 0,
      resultados,
      artilharia,
      grupos,
    })
  } catch (err: unknown) {
    console.error('cron/sync error:', err)
    const message = err instanceof Error ? err.message : 'Falha ao executar sincronização'
    return Response.json({ error: message }, { status: 500 })
  }
}
