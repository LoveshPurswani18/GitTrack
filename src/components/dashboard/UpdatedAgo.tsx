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

/** "Updated 4 min ago", kept current. Renders nothing until the browser clock is known. */
export function UpdatedAgo({ fetchedAt }: { fetchedAt: string }) {
  const slot = useSyncExternalStore(subscribe, getSlot, getServerSlot);
  if (slot === null) return null;
  return (
    <p className="text-caption text-text-muted">
      Updated {timeAgo(fetchedAt, new Date(slot * TICK_MS))}
    </p>
  );
}
