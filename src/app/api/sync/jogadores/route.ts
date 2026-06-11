import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeAdminRequest } from '@/lib/auth-admin'
import { fetchTeams, mapZafronixPosition } from '@/lib/zafronix'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminRequest(request))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const { data: teams, error: teamsError } = await supabase.from('teams').select('id, code, name')

    if (teamsError) return Response.json({ error: teamsError.message }, { status: 500 })
    if (!teams || teams.length === 0) {
      return Response.json({ error: 'Nenhum time encontrado — execute "Popular times" primeiro' }, { status: 400 })
    }

    const teamByCode = new Map(teams.map(t => [t.code, t]))

    const zafronixTeams = await fetchTeams()

    let updated = 0

    for (const zt of zafronixTeams) {
      const team = teamByCode.get(zt.code)
      if (!team) continue

      try {
        const { data: existing } = await supabase
          .from('players')
          .select('id, name')
          .eq('team_id', team.id)

        const existingByName = new Map((existing ?? []).map(p => [p.name, p.id as string]))

        for (const p of zt.squad) {
          const row = {
            team_id: team.id,
            name: p.name,
            position: mapZafronixPosition(p.position),
            goals_in_tournament: p.goals ?? 0,
          }

          const existingId = existingByName.get(row.name)
          if (existingId) {
            await supabase.from('players').update(row).eq('id', existingId)
          } else {
            await supabase.from('players').insert(row)
          }
          updated++
        }
      } catch (teamErr) {
        console.error(`sync/jogadores error for team ${team.name}:`, teamErr)
      }
    }

    return Response.json({ updated })
  } catch (err: unknown) {
    console.error('sync/jogadores error:', err)
    const message = err instanceof Error ? err.message : 'Falha ao sincronizar jogadores'
    return Response.json({ error: message }, { status: 500 })
  }
}
