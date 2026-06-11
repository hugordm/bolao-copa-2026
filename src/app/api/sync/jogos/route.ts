import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { syncJogos } from '@/lib/sync/jogos'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const result = await syncJogos(supabase)
    return Response.json(result)
  } catch (err: unknown) {
    console.error('sync/jogos error:', err)
    const message = err instanceof Error ? err.message : 'Falha ao sincronizar jogos'
    return Response.json({ error: message }, { status: 500 })
  }
}
