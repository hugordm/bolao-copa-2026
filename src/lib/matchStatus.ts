/** A match is live once kickoff has passed and it hasn't been marked finished yet. */
export function isMatchLive(kickoffAt: string, isFinished: boolean, now: number = Date.now()): boolean {
  return !isFinished && new Date(kickoffAt).getTime() <= now
}

/** True for a live match whose score hasn't been confirmed by the API yet (still 0x0). */
export function isLiveWithoutScore(
  isLive: boolean,
  homeScore: number | null,
  awayScore: number | null
): boolean {
  return isLive && (homeScore ?? 0) === 0 && (awayScore ?? 0) === 0
}
