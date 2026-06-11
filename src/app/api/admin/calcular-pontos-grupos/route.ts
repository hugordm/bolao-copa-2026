import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { calcularPontosGrupos } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { updatedStandings, updatedBets } = await calcularPontosGrupos(supabase)

    return Response.json({ updated_standings: updatedStandings, updated_bets: updatedBets })
  } catch (err: unknown) {
    console.error('calcular-pontos-grupos error:', err)
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
