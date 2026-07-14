import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { apurarArtilheiroSelecao } from '@/lib/artilheiro'

export const dynamic = 'force-dynamic'

type FinalStatus = 'active' | 'eliminated' | 'champion' | 'runner_up' | 'third' | 'fourth'

// Maps each status to how the team row should be persisted.
// `final_position` null means the team is still active (default state).
const STATUS_MAP: Record<FinalStatus, { final_position: string | null; is_eliminated: boolean }> = {
  active: { final_position: null, is_eliminated: false },
  eliminated: { final_position: 'eliminated', is_eliminated: true },
  champion: { final_position: 'champion', is_eliminated: false },
  runner_up: { final_position: 'runner_up', is_eliminated: true },
  third: { final_position: 'third', is_eliminated: true },
  fourth: { final_position: 'fourth', is_eliminated: true },
}

/**
 * Settles every `champion` special bet: awards `pts_champion` to bets that
 * picked `championTeamId` (0 otherwise) and locks them. Called when a team is
 * crowned champion so the whole prediction pool is resolved at once.
 */
async function apurarCampeao(
  supabase: ReturnType<typeof createAdminClient>,
  championTeamId: string
): Promise<number> {
  const { data: config } = await supabase
    .from('score_config')
    .select('pts_champion')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const ptsChampion = config?.pts_champion ?? 0

  const { data: bets } = await supabase
    .from('special_bets')
    .select('id, team_id')
    .eq('bet_type', 'champion')

  let betsCalculated = 0
  for (const bet of bets ?? []) {
    const points = bet.team_id === championTeamId ? ptsChampion : 0
    const { error } = await supabase
      .from('special_bets')
      .update({ points_earned: points, is_locked: true })
      .eq('id', bet.id)
    if (!error) betsCalculated++
  }

  return betsCalculated
}

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { team_id, status } = (await request.json()) as {
      team_id?: string
      status?: FinalStatus
    }

    if (!team_id) {
      return Response.json({ error: '"team_id" é obrigatório' }, { status: 400 })
    }
    if (!status || !(status in STATUS_MAP)) {
      return Response.json({ error: '"status" inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { final_position, is_eliminated } = STATUS_MAP[status]

    const { error: updateError } = await supabase
      .from('teams')
      .update({ final_position, is_eliminated })
      .eq('id', team_id)
    if (updateError) throw updateError

    let championBets = 0
    if (status === 'champion') {
      championBets = await apurarCampeao(supabase, team_id)
    }

    // Any status other than "active" means the team is out of the tournament,
    // so its top scorer is final and the team_scorer bets can be settled.
    let scorer: { winner: string | null; betsCalculated: number } = {
      winner: null,
      betsCalculated: 0,
    }
    if (status !== 'active') {
      const { winner, betsCalculated } = await apurarArtilheiroSelecao(supabase, team_id)
      scorer = { winner, betsCalculated }
    }

    return Response.json({
      winner: scorer.winner,
      scorer_bets_calculated: scorer.betsCalculated,
      champion_bets_calculated: championBets,
    })
  } catch (err: unknown) {
    console.error('marcar-status-final error:', err)
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
