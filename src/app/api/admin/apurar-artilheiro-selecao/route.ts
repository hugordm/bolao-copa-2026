import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { apurarArtilheiroSelecao } from '@/lib/artilheiro'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { team_id } = await request.json()
    if (!team_id) {
      return Response.json({ error: '"team_id" é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { winner, betsCalculated } = await apurarArtilheiroSelecao(supabase, team_id)

    return Response.json({ winner, bets_calculated: betsCalculated })
  } catch (err: unknown) {
    console.error('apurar-artilheiro-selecao error:', err)
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
