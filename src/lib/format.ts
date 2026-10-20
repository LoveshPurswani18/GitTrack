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

/** "1 commit" or "N commits". */
export function commitCount(n: number): string {
  return `${n} ${n === 1 ? "commit" : "commits"}`;
}
