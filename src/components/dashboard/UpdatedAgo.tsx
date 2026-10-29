"use client";

import { useSyncExternalStore } from "react";
import { timeAgo } from "@/lib/format";

const TICK_MS = 30_000;

// The current 30-second slot: a stable value between ticks, as useSyncExternalStore needs.
const getSlot = () => Math.floor(Date.now() / TICK_MS);
const getServerSlot = () => null;
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, TICK_MS);
  return () => clearInterval(id);
}

/** "4 min ago", kept current. Null until the browser clock is known (server and hydration). */
export function useTimeAgo(fetchedAt: string): string | null {
  const slot = useSyncExternalStore(subscribe, getSlot, getServerSlot);
  return slot === null ? null : timeAgo(fetchedAt, new Date(slot * TICK_MS));
}

/** "Updated 4 min ago". Renders nothing until the browser clock is known. */
export function UpdatedAgo({ fetchedAt }: { fetchedAt: string }) {
  const ago = useTimeAgo(fetchedAt);
  if (ago === null) return null;
  return <p className="text-caption text-text-muted">Updated {ago}</p>;
}
