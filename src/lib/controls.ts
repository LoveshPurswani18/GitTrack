import type { Scope } from "@/lib/metrics/filter";
import type { Range } from "@/lib/metrics/range";

/** The three dashboard controls, kept in the URL as ?range=6m&repos=all&tz=Asia%2FKolkata. */
export type Controls = { range: Range; scope: Scope; tz: string };

export const DEFAULT_RANGE: Range = "today";
export const DEFAULT_SCOPE: Scope = "all";

export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

export const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
];

const RANGE_LABELS: Record<Range, string> = {
  today: "today",
  "1w": "last 7 days",
  "1m": "last month",
  "6m": "last 6 months",
  "1y": "last 12 months",
};

/** How a range reads next to a number (DESIGN.md §2). */
export function rangeLabel(range: Range): string {
  return RANGE_LABELS[range];
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the controls from a query string. Anything missing or invalid falls back to the
 * default (today, all repos, the browser's zone), so a hand-edited URL never breaks the page.
 */
export function parseControls(search: string, browserZone: string): Controls {
  const params = new URLSearchParams(search);
  const range = params.get("range");
  const scope = params.get("repos");
  const tz = params.get("tz");
  return {
    range: RANGE_OPTIONS.find((o) => o.value === range)?.value ?? DEFAULT_RANGE,
    scope: SCOPE_OPTIONS.find((o) => o.value === scope)?.value ?? DEFAULT_SCOPE,
    tz: tz && isValidTimeZone(tz) ? tz : isValidTimeZone(browserZone) ? browserZone : "UTC",
  };
}

/** The query string (with the leading "?") for the given controls. */
export function controlsToSearch(controls: Controls): string {
  const params = new URLSearchParams({
    range: controls.range,
    repos: controls.scope,
    tz: controls.tz,
  });
  return `?${params.toString()}`;
}
