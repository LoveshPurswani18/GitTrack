const DAY_MS = 24 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Throws RangeError for an unknown zone; callers validate the IANA name first.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar day (YYYY-MM-DD) an instant falls on in the given IANA timezone. */
export function toLocalDay(instant: string | Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(
    typeof instant === "string" ? new Date(instant) : instant,
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayToUtcMs(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

function utcMsToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Shifts a YYYY-MM-DD day by whole days. Date-only arithmetic, so no timezone is involved. */
export function addDays(day: string, n: number): string {
  return utcMsToDay(dayToUtcMs(day) + n * DAY_MS);
}

/** Every day from start to end, both inclusive. Empty when end is before start. */
export function dayRange(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Weekday of a day, Monday = 0 … Sunday = 6. */
export function weekday(day: string): number {
  return (new Date(dayToUtcMs(day)).getUTCDay() + 6) % 7;
}

/** The Monday on or before the given day. */
export function startOfWeek(day: string): string {
  return addDays(day, -weekday(day));
}
