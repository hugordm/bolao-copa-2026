import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { recalcularTodosPontos } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { matches, updatedBets } = await recalcularTodosPontos(supabase)

    return Response.json({ matches, updated: updatedBets })
  } catch (err: unknown) {
    console.error('recalcular-pontos error:', err)
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
