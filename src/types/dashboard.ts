import type { Activity } from "./activity";

/** A GitHub failure as plain data, safe to hand to client components. Never holds the token. */
export type DashboardError = {
  kind: "token" | "rate_limit" | "network";
  message: string;
  resetAt?: string; // ISO UTC, rate_limit only
};

/**
 * What the dashboard has to show: fresh data, the last good data with the reason a refresh
 * failed (stale), or nothing but the reason (error).
 */
export type DashboardResult =
  | { status: "ok"; activity: Activity }
  | { status: "stale"; activity: Activity; error: DashboardError }
  | { status: "error"; error: DashboardError };
