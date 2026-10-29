"use server";

import { redirect } from "next/navigation";
import { checkCredentials } from "@/lib/auth/credentials";
import { getGate } from "@/lib/auth/gate";
import { startSession } from "@/lib/auth/session";

export type UnlockState = { failed: boolean };

/** A wrong login waits this long before answering, so guesses cannot be fired off quickly. */
const FAILURE_DELAY_MS = 1000;

/**
 * Checks the login form. Right: sets the pass and goes to the dashboard. Wrong (username or key,
 * never said which, and an unconfigured gate counts too): waits, then answers the same message.
 * This is the only server action that does not need a session, since it is how one starts.
 */
export async function unlock(_previous: UnlockState, formData: FormData): Promise<UnlockState> {
  const gate = getGate();
  const username = String(formData.get("username") ?? "");
  const key = String(formData.get("key") ?? "");

  if (gate.ready && checkCredentials({ username, key }, gate)) {
    await startSession();
    redirect("/");
  }
  await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
  return { failed: true };
}
