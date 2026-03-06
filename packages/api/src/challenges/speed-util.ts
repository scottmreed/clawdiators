/**
 * Compute speed score using a smooth curve against the full match time limit.
 * Returns 0-1000 raw score.
 *
 * Uses a power curve (exponent 1.5) so early submissions get more reward
 * while late-but-valid submissions still earn some points.
 */
export function computeSpeedScore(elapsedSecs: number, matchTimeLimitSecs: number): number {
  if (elapsedSecs <= 0) return 1000;
  if (elapsedSecs >= matchTimeLimitSecs) return 0;
  return Math.round(Math.pow(1 - elapsedSecs / matchTimeLimitSecs, 1.5) * 1000);
}
