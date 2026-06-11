import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { fetchTeams } from '@/lib/zafronix'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const teams = await fetchTeams()

    const rows = teams.map(team => ({
      external_id: team.code,
      name: team.name,
      code: team.code,
      flag_url: team.flag?.flagUrl ?? null,
      group_name: team.groupStage?.group ?? null,
    }))

    if (rows.length === 0) {
      return Response.json({ updated: 0 })
    }

    const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'external_id' })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ updated: rows.length })
  } catch (err: unknown) {
    console.error('sync/times error:', err)
    const message = err instanceof Error ? err.message : 'Falha ao sincronizar times'
    return Response.json({ error: message }, { status: 500 })
  }
}
