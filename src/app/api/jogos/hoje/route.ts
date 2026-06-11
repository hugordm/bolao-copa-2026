import { createAdminClient } from '@/lib/supabase/admin'
import { dateBrasilia } from '@/lib/zafronix'
import { getJogosDoDia } from '@/lib/sync/jogosDoDia'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const today = dateBrasilia(new Date())
    const jogos = await getJogosDoDia(supabase, today)
    return Response.json(jogos)
  } catch (err: unknown) {
    console.error('jogos/hoje error:', err)
    return Response.json({ error: 'Falha ao buscar jogos' }, { status: 500 })
  }
}
