/** How long after one refresh the next one is ignored. */
export const REFRESH_COOLDOWN_MS = 60_000;

/**
 * True when a refresh may run: none yet, or the last one was at least a minute ago. The caller
 * keeps `lastRefreshAt` in server memory, so on a serverless host each instance counts for itself
 * (a best-effort guard for the GitHub rate limit, not a hard limit).
 */
export function canRefresh(lastRefreshAt: number | null, now: number): boolean {
  return lastRefreshAt === null || now - lastRefreshAt >= REFRESH_COOLDOWN_MS;
}
