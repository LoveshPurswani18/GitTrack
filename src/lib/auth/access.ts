import "server-only";

import type { GateConfig } from "./gate";

export type Access =
  /** Let the request through. */
  | { kind: "allow" }
  /** Send a page or data GET to the unlock screen (no data in the response). */
  | { kind: "redirect"; to: string }
  /** Send an already unlocked visitor from the unlock screen to the dashboard. */
  | { kind: "home" }
  /** Show the unavailable screen (the gate is not configured). Nothing else is served. */
  | { kind: "unavailable" }
  /** A plain status with no body: 401 without a session, 503 when the gate is unavailable. */
  | { kind: "deny"; status: 401 | 503 };

export const UNLOCK_PATH = "/unlock";

/**
 * Public files the unlock screen needs. `_next/static` and `_next/image` are left out of the proxy
 * by its matcher. Nothing else is public.
 */
const PUBLIC_PATHS = new Set(["/icon.svg", "/favicon.ico", "/robots.txt", "/logo-ink.svg", "/logo-white.svg"]);

const READ_METHODS = new Set(["GET", "HEAD"]);

/**
 * The gate's one rule set, pure so it can be tested. Without a valid session the only thing a
 * visitor can reach is the unlock screen and the public files; every other read is redirected and
 * every other method (server actions, API calls) gets a bare 401. If the gate is not configured,
 * nothing is served at all.
 */
export function decideAccess(input: {
  pathname: string;
  method: string;
  gate: GateConfig;
  hasSession: boolean;
}): Access {
  const { pathname, method, gate, hasSession } = input;
  const read = READ_METHODS.has(method.toUpperCase());

  if (PUBLIC_PATHS.has(pathname)) return { kind: "allow" };

  if (!gate.ready) return read ? { kind: "unavailable" } : { kind: "deny", status: 503 };

  if (pathname === UNLOCK_PATH) {
    return hasSession && read ? { kind: "home" } : { kind: "allow" };
  }
  if (hasSession) return { kind: "allow" };
  return read ? { kind: "redirect", to: UNLOCK_PATH } : { kind: "deny", status: 401 };
}
