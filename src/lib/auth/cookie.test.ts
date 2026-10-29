import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "./cookie";

const SECRET = "s".repeat(44);
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

describe("session cookie", () => {
  it("accepts a pass it signed", () => {
    expect(verifySession(SECRET, signSession(SECRET, NOW), NOW + 1000)).toBe(true);
  });

  it("lasts 30 days", () => {
    const pass = signSession(SECRET, NOW);
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(verifySession(SECRET, pass, NOW + 29 * DAY)).toBe(true);
    expect(verifySession(SECRET, pass, NOW + 30 * DAY + 1000)).toBe(false);
  });

  it("rejects a pass signed with another secret (rotating the secret ends every session)", () => {
    expect(verifySession("t".repeat(44), signSession(SECRET, NOW), NOW)).toBe(false);
  });

  it("rejects a changed expiry or signature", () => {
    const [version, expiry, signature] = signSession(SECRET, NOW).split(".");
    const later = `${version}.${Number(expiry) + 86_400 * 365}.${signature}`;
    expect(verifySession(SECRET, later, NOW)).toBe(false);
    expect(verifySession(SECRET, `${version}.${expiry}.${signature.slice(0, -1)}A`, NOW)).toBe(false);
    expect(verifySession(SECRET, `${version}.${expiry}.${signature}x`, NOW)).toBe(false);
  });

  it("rejects missing, empty and malformed values without throwing", () => {
    for (const bad of [undefined, "", ".", "v1", "v1.123", "v1..sig", "v2.1.sig", "v1.abc.sig", "v1.1.2.3", "😀"]) {
      expect(verifySession(SECRET, bad, NOW)).toBe(false);
    }
  });
});
