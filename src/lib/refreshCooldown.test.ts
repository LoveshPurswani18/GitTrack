import { describe, expect, it } from "vitest";
import { REFRESH_COOLDOWN_MS, canRefresh } from "./refreshCooldown";

describe("canRefresh", () => {
  it("allows the first refresh", () => {
    expect(canRefresh(null, 1_000_000)).toBe(true);
  });

  it("blocks a second refresh inside 60 seconds", () => {
    expect(REFRESH_COOLDOWN_MS).toBe(60_000);
    expect(canRefresh(1_000_000, 1_000_000)).toBe(false);
    expect(canRefresh(1_000_000, 1_059_999)).toBe(false);
  });

  it("allows it again from 60 seconds on", () => {
    expect(canRefresh(1_000_000, 1_060_000)).toBe(true);
    expect(canRefresh(1_000_000, 2_000_000)).toBe(true);
  });
});
