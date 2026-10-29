const PINNED = ["Asia/Kolkata", "UTC"];

/** "UTC+5:30" for the zone's offset at the given instant; "UTC+0" for zero offset. */
export function utcOffsetLabel(timeZone: string, now: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  if (!part || part === "GMT") return "UTC+0";
  return part.replace("GMT", "UTC");
}

function allZones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : [...zones, "UTC"].sort();
}

/** Zones pinned first (browser zone, Asia/Kolkata, UTC; deduplicated), then the rest A–Z. */
export function zoneOptions(browserZone: string): { pinned: string[]; rest: string[] } {
  const pinned = [...new Set([browserZone, ...PINNED])];
  return { pinned, rest: allZones().filter((z) => !pinned.includes(z)) };
}

const normalise = (s: string) => s.toLowerCase().replace(/[_\s]+/g, " ").trim();

/** Case-insensitive match where "_" and spaces are the same ("new york" finds "America/New_York"). */
export function filterZones(zones: string[], query: string): string[] {
  const q = normalise(query);
  if (!q) return zones;
  return zones.filter((z) => normalise(z).includes(q));
}
