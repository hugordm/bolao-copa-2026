import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { syncResultados } from '@/lib/sync/resultados'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const result = await syncResultados(supabase)
    return Response.json(result)
  } catch (err: unknown) {
    console.error('sync/resultados error:', err)
    const message = err instanceof Error ? err.message : 'Falha ao sincronizar resultados'
    return Response.json({ error: message }, { status: 500 })
  }
}
