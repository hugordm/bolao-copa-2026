import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { recalcularPontosDoJogo } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { match_id } = await request.json()
    if (!match_id) {
      return Response.json({ error: '"match_id" é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updated = await recalcularPontosDoJogo(supabase, match_id)

    return Response.json({ updated })
  } catch (err: unknown) {
    console.error('calcular-pontos error:', err)
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
