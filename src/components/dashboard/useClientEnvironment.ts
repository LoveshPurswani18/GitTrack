"use client";

import { useSyncExternalStore } from "react";

export type ClientEnvironment = { now: Date; browserZone: string };

// Taken once per page load and again whenever fresh data arrives (see refreshClientEnvironment),
// so "today" stays fixed in between.
let cached: ClientEnvironment | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ClientEnvironment {
  cached ??= { now: new Date(), browserZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  return cached;
}

const getServerSnapshot = (): ClientEnvironment | null => null;
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Takes a new "now" and re-renders everything reading it. Called when refreshed data arrives. */
export function refreshClientEnvironment() {
  cached = { now: new Date(), browserZone: getSnapshot().browserZone };
  listeners.forEach((listener) => listener());
}

/**
 * The browser's clock and timezone, which the server cannot know. It is null on the server and
 * during hydration, so callers render a skeleton first and nothing mismatches.
 */
export function useClientEnvironment(): ClientEnvironment | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
