"use client";

import { useSyncExternalStore } from "react";

export type ClientEnvironment = { now: Date; browserZone: string };

// Taken once per page load. "Today" therefore stays fixed until a reload or the refresh in 3.1.
let cached: ClientEnvironment | null = null;

function getSnapshot(): ClientEnvironment {
  cached ??= { now: new Date(), browserZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  return cached;
}

const getServerSnapshot = (): ClientEnvironment | null => null;
const subscribe = () => () => {};

/**
 * The browser's clock and timezone, which the server cannot know. It is null on the server and
 * during hydration, so callers render a skeleton first and nothing mismatches.
 */
export function useClientEnvironment(): ClientEnvironment | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
