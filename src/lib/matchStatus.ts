/** A match is live once kickoff has passed and it hasn't been marked finished yet. */
export function isMatchLive(kickoffAt: string, isFinished: boolean, now: number = Date.now()): boolean {
  return !isFinished && new Date(kickoffAt).getTime() <= now
}
