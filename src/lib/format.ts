// en-US, not en-GB: newer ICU versions spell September "Sept" in en-GB. The order is built below.
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "Tue, 14 Oct" for a YYYY-MM-DD day. Formatted in UTC so no timezone can shift the date. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const parts = dayFormatter.formatToParts(new Date(Date.UTC(year, month - 1, date)));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

const dayMonthFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "10 Oct" for a YYYY-MM-DD day. Formatted in UTC so no timezone can shift the date. */
export function formatDayMonth(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const parts = dayMonthFormatter.formatToParts(new Date(Date.UTC(year, month - 1, date)));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("day")} ${get("month")}`;
}

/** "1 commit" or "N commits". */
export function commitCount(n: number): string {
  return `${n} ${n === 1 ? "commit" : "commits"}`;
}

/** The repo name without its owner: "owner/name" becomes "name". */
export function repoName(nameWithOwner: string): string {
  return nameWithOwner.slice(nameWithOwner.indexOf("/") + 1);
}

/**
 * Visible label per repo: the bare name, or "owner/name" for repos whose bare names collide,
 * so two rows never read the same.
 */
export function repoLabels(repos: string[]): Map<string, string> {
  const seen = new Map<string, number>();
  for (const repo of repos) seen.set(repoName(repo), (seen.get(repoName(repo)) ?? 0) + 1);
  return new Map(repos.map((repo) => [repo, seen.get(repoName(repo))! > 1 ? repo : repoName(repo)]));
}

/** "just now", "4 min ago", "2 hours ago" or "3 days ago" for how long ago an instant was. */
export function timeAgo(iso: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** "14:05": the wall-clock time of an instant in the given IANA timezone, 24-hour. */
export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}
