import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gt_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const VERSION = "v1";

function signature(secret: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(`${VERSION}.${expiresAt}`).digest("base64url");
}

/** The pass: `v1.<expiry in epoch seconds>.<HMAC-SHA256 of that, keyed with the cookie secret>`. */
export function signSession(secret: string, now: number = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  return `${VERSION}.${expiresAt}.${signature(secret, expiresAt)}`;
}

/** True only for a pass signed with this secret that has not expired. Never throws. */
export function verifySession(secret: string, value: string | undefined, now: number = Date.now()): boolean {
  if (!value) return false;
  const [version, expiry, given, ...rest] = value.split(".");
  if (version !== VERSION || rest.length > 0 || !expiry || !given || !/^\d{1,12}$/.test(expiry)) return false;
  const expiresAt = Number(expiry);

  const expected = Buffer.from(signature(secret, expiresAt));
  const actual = Buffer.from(given);
  // Compare in constant time, after the length check that timingSafeEqual requires.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  return expiresAt * 1000 > now;
}
