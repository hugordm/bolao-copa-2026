import type { SupabaseClient } from '@supabase/supabase-js'
import { recalcularPontosDoJogo } from '@/lib/scoring'
import { fetchMatches } from '@/lib/zafronix'

const THREE_HOURS_MS = 3 * 60 * 60 * 1000

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
    .select('id, external_id, home_score, away_score, is_finished, manually_edited')
    .in('external_id', externalIds)

  if (matchesError) throw new Error(matchesError.message)

  const matchByExternalId = new Map((rows ?? []).map(m => [m.external_id, m]))

  let updated = 0
  let calculated = 0

  for (const m of matches) {
    const match = matchByExternalId.get(m.id)
    if (!match) continue

    console.log('[sync] jogo', match.id, 'manually_edited:', match.manually_edited)

    if (!match.manually_edited) {
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
    }

    calculated += await recalcularPontosDoJogo(supabase, match.id)
  }

  // Detecta jogos que estão marcados como ao vivo há mais de 3 horas sem atualização
  const cutoff = new Date(Date.now() - THREE_HOURS_MS).toISOString()
  const { data: stuckMatches } = await supabase
    .from('matches')
    .select('id, external_id, kickoff_at')
    .eq('is_finished', false)
    .lte('kickoff_at', cutoff)

  for (const stuck of stuckMatches ?? []) {
    if (!stuck.external_id) {
      console.warn(
        `[sync] AVISO: jogo ${stuck.id} (kickoff ${stuck.kickoff_at}) está ao vivo há mais de 3h e NÃO TEM external_id — não pode ser atualizado pelo sync automático`
      )
    } else {
      console.warn(
        `[sync] AVISO: jogo ${stuck.id} (external_id ${stuck.external_id}, kickoff ${stuck.kickoff_at}) está ao vivo há mais de 3h sem ser marcado como encerrado`
      )
    }
  }

  return { updated, calculated }
}
