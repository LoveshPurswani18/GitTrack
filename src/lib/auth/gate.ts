import "server-only";

/**
 * The access gate's configuration, read from the environment. The gate never throws: a missing or
 * malformed value makes it `unavailable`, and every route then shows the generic unavailable
 * screen (it fails closed). `reason` names the problem for the server log only, never values.
 */
export type GateConfig =
  | { ready: true; keyHash: string; cookieSecret: string; username: string }
  | { ready: false; reason: string };

type Env = Record<string, string | undefined>;

const KEY_HASH = /^[0-9a-f]{64}$/;
/** `openssl rand -base64 32` gives 44 characters; anything under 32 is too guessable to sign with. */
const MIN_SECRET_LENGTH = 32;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseGate(env: Env): GateConfig {
  const keyHash = clean(env.AUTH_KEY_HASH)?.toLowerCase();
  const cookieSecret = clean(env.AUTH_COOKIE_SECRET);
  const username = clean(env.GITHUB_USERNAME);

  const missing = [
    ["AUTH_KEY_HASH", keyHash],
    ["AUTH_COOKIE_SECRET", cookieSecret],
    ["GITHUB_USERNAME", username],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) return { ready: false, reason: `missing ${missing.join(", ")}` };

  if (!KEY_HASH.test(keyHash!)) {
    return { ready: false, reason: "AUTH_KEY_HASH is not 64 hexadecimal characters" };
  }
  if (cookieSecret!.length < MIN_SECRET_LENGTH) {
    return { ready: false, reason: `AUTH_COOKIE_SECRET is shorter than ${MIN_SECRET_LENGTH} characters` };
  }
  return { ready: true, keyHash: keyHash!, cookieSecret: cookieSecret!, username: username! };
}

export function getGate(): GateConfig {
  return parseGate(process.env);
}
