import type { DashboardError } from "@/types/dashboard";

export type StateCopy = {
  tone: "warning" | "danger";
  title: string;
  detail: string;
  /** The centred card shown when there is nothing cached. */
  noData: string;
};

/**
 * The words for each failure (DESIGN.md §6.9 and §8). Times arrive already formatted in the
 * browser's timezone: `cachedAt` when old data is still on screen, `resetAt` for a rate limit.
 */
export function stateCopy(
  error: DashboardError,
  times: { cachedAt?: string; resetAt?: string },
): StateCopy {
  const cached = times.cachedAt ? `Showing cached data from ${times.cachedAt}.` : null;

  if (error.kind === "rate_limit") {
    const reset = times.resetAt ? `Refresh works again at ${times.resetAt}.` : null;
    return {
      tone: "warning",
      title: "GitHub rate limit reached",
      detail: [cached, reset].filter(Boolean).join(" ") || "Try again in a few minutes.",
      noData:
        "GitTrack can't read your activity until the rate limit resets. Nothing is cached yet.",
    };
  }

  if (error.kind === "token") {
    return {
      tone: "danger",
      title: "GitHub token rejected",
      detail: "Check GITHUB_TOKEN in the environment variables, then refresh.",
      noData: "GitTrack can't read your activity until the token works. Nothing is cached yet.",
    };
  }

  return {
    tone: "danger",
    title: "Could not reach GitHub",
    detail: cached ?? "Check your connection, then try again.",
    noData: "GitTrack can't reach GitHub right now. Nothing is cached yet.",
  };
}
