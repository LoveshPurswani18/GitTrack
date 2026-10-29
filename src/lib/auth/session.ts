import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "./cookie";
import { getGate } from "./gate";
import { UNLOCK_PATH } from "./access";

/** True when this request carries a valid, unexpired pass. Needs a request, so it sits behind Suspense. */
export async function hasSession(): Promise<boolean> {
  const gate = getGate();
  if (!gate.ready) return false;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(gate.cookieSecret, value);
}

/**
 * The check every server action and every data read starts with (the proxy is the first layer,
 * this is the one next to the data). Without a pass it sends the visitor to the unlock screen and
 * nothing after it runs.
 */
export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect(UNLOCK_PATH);
}

/** Starts a session: sets the signed pass. Only call it after the key was checked. */
export async function startSession(): Promise<void> {
  const gate = getGate();
  if (!gate.ready) throw new Error("The access gate is not configured");
  (await cookies()).set(SESSION_COOKIE, signSession(gate.cookieSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Ends the session on this browser: the pass is deleted. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
