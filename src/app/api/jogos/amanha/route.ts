import { createAdminClient } from '@/lib/supabase/admin'
import { dateBrasilia } from '@/lib/zafronix'
import { getJogosDoDia } from '@/lib/sync/jogosDoDia'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const jogos = await getJogosDoDia(supabase, dateBrasilia(tomorrow))
    return Response.json(jogos)
  } catch (err: unknown) {
    console.error('jogos/amanha error:', err)
    return Response.json({ error: 'Falha ao buscar jogos' }, { status: 500 })
  }
}
