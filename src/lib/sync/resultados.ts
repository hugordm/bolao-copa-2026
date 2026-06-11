import type { SupabaseClient } from '@supabase/supabase-js'
import { recalcularPontosDoJogo } from '@/lib/scoring'
import { fetchMatches } from '@/lib/zafronix'

/** Updates finished matches from Zafronix and recalculates bet points. */
export async function syncResultados(
  supabase: SupabaseClient
): Promise<{ updated: number; calculated: number }> {
  const matches = (await fetchMatches()).filter(m => m.result !== null)

  if (matches.length === 0) {
    return { updated: 0, calculated: 0 }
  }

  const externalIds = matches.map(m => m.id)
  const { data: rows, error: matchesError } = await supabase
    .from('matches')
    .select('id, external_id, home_score, away_score, is_finished')
    .in('external_id', externalIds)

  if (matchesError) throw new Error(matchesError.message)

  const matchByExternalId = new Map((rows ?? []).map(m => [m.external_id, m]))

  let updated = 0
  let calculated = 0

  for (const m of matches) {
    const match = matchByExternalId.get(m.id)
    if (!match) continue

    const changed =
      !match.is_finished || match.home_score !== m.homeScore || match.away_score !== m.awayScore

    if (changed) {
      const { error } = await supabase
        .from('matches')
        .update({ home_score: m.homeScore, away_score: m.awayScore, is_finished: true })
        .eq('id', match.id)
      if (error) continue
      updated++
    }

    calculated += await recalcularPontosDoJogo(supabase, match.id)
  }

  return { updated, calculated }
}
