import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { GateConfig } from "./gate";

/** Nobody types a longer key; this stops a huge body from being hashed. */
const MAX_LENGTH = 512;

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest();

/**
 * Checks the login form. The username (the public GitHub username, compared exactly with
 * GITHUB_USERNAME: capitals count, surrounding spaces do not) is there for the password manager and
 * adds no security. The key is hashed with
 * SHA-256 and compared in constant time with AUTH_KEY_HASH. Both checks always run, so a wrong
 * username takes no less time than a wrong key.
 */
export function checkCredentials(
  input: { username: string; key: string },
  gate: Extract<GateConfig, { ready: true }>,
): boolean {
  const username = input.username.trim().slice(0, MAX_LENGTH);
  const key = input.key.slice(0, MAX_LENGTH + 1);

  const usernameOk = timingSafeEqual(sha256(username), sha256(gate.username));
  const keyOk = timingSafeEqual(sha256(key), Buffer.from(gate.keyHash, "hex"));
  return usernameOk && keyOk && input.key.length > 0 && input.key.length <= MAX_LENGTH;
}
