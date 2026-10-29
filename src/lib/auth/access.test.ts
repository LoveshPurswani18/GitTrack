import { describe, expect, it } from "vitest";
import { decideAccess } from "./access";
import type { GateConfig } from "./gate";

const ready: GateConfig = { ready: true, keyHash: "a".repeat(64), cookieSecret: "s".repeat(44), username: "u" };
const unavailable: GateConfig = { ready: false, reason: "missing AUTH_KEY_HASH" };

const decide = (pathname: string, method = "GET", hasSession = false, gate: GateConfig = ready) =>
  decideAccess({ pathname, method, gate, hasSession });

describe("decideAccess without a session", () => {
  it("sends every page and data read to the unlock screen", () => {
    for (const path of ["/", "/profile", "/dev/live-check", "/anything/else", "/_next/data/x.json"]) {
      expect(decide(path)).toEqual({ kind: "redirect", to: "/unlock" });
      expect(decide(path, "HEAD")).toEqual({ kind: "redirect", to: "/unlock" });
    }
  });

  it("answers anything that is not a read (server actions, API calls) with a bare 401", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(decide("/", method)).toEqual({ kind: "deny", status: 401 });
      expect(decide("/profile", method)).toEqual({ kind: "deny", status: 401 });
    }
  });

  it("lets the unlock screen and its form through, with any method", () => {
    expect(decide("/unlock")).toEqual({ kind: "allow" });
    expect(decide("/unlock", "POST")).toEqual({ kind: "allow" });
  });

  it("lets the public files through, and only those", () => {
    for (const path of ["/icon.svg", "/favicon.ico", "/robots.txt", "/logo-ink.svg", "/logo-white.svg"]) {
      expect(decide(path)).toEqual({ kind: "allow" });
    }
    expect(decide("/unlock/anything")).toEqual({ kind: "redirect", to: "/unlock" });
    expect(decide("/icon.svg.map")).toEqual({ kind: "redirect", to: "/unlock" });
  });
});

describe("decideAccess with a session", () => {
  it("lets everything through", () => {
    for (const method of ["GET", "POST"]) {
      expect(decide("/", method, true)).toEqual({ kind: "allow" });
      expect(decide("/profile", method, true)).toEqual({ kind: "allow" });
    }
  });

  it("sends an unlocked visitor from the unlock screen to the dashboard, but lets the form post", () => {
    expect(decide("/unlock", "GET", true)).toEqual({ kind: "home" });
    expect(decide("/unlock", "POST", true)).toEqual({ kind: "allow" });
  });
});

describe("decideAccess when the gate is not configured (fails closed)", () => {
  it("shows the unavailable screen for every read, even with a session cookie", () => {
    for (const path of ["/", "/profile", "/unlock"]) {
      expect(decide(path, "GET", false, unavailable)).toEqual({ kind: "unavailable" });
      expect(decide(path, "GET", true, unavailable)).toEqual({ kind: "unavailable" });
    }
  });

  it("answers everything else with a bare 503", () => {
    expect(decide("/", "POST", true, unavailable)).toEqual({ kind: "deny", status: 503 });
    expect(decide("/unlock", "POST", false, unavailable)).toEqual({ kind: "deny", status: 503 });
  });

  it("still serves the public files, which the unavailable screen needs", () => {
    expect(decide("/logo-ink.svg", "GET", false, unavailable)).toEqual({ kind: "allow" });
  });
});
