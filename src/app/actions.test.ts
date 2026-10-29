import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
const requireSession = vi.fn();
const endSession = vi.fn();

vi.mock("next/cache", () => ({ updateTag }));
vi.mock("@/lib/auth/session", () => ({ requireSession, endSession }));

async function freshActions() {
  vi.resetModules(); // the cooldown lives in module memory
  return import("./actions");
}

beforeEach(() => {
  updateTag.mockClear();
  requireSession.mockReset().mockResolvedValue(undefined);
  endSession.mockClear();
  vi.useRealTimers();
});

describe("refreshData", () => {
  it("checks the session first, and does nothing when there is none", async () => {
    requireSession.mockRejectedValue(new Error("NEXT_REDIRECT:/unlock"));
    const { refreshData } = await freshActions();
    await expect(refreshData()).rejects.toThrow("NEXT_REDIRECT:/unlock");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("expires the github cache once, then ignores refreshes for 60 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    const { refreshData } = await freshActions();

    await refreshData();
    expect(updateTag).toHaveBeenCalledWith("github");
    expect(updateTag).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await refreshData(); // inside the cooldown: quietly nothing
    expect(updateTag).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await refreshData();
    expect(updateTag).toHaveBeenCalledTimes(2);
  });

  it("still checks the session inside the cooldown", async () => {
    const { refreshData } = await freshActions();
    await refreshData();
    requireSession.mockRejectedValue(new Error("NEXT_REDIRECT:/unlock"));
    await expect(refreshData()).rejects.toThrow("NEXT_REDIRECT:/unlock");
  });
});

describe("lock", () => {
  it("ends the session, and needs none to do so", async () => {
    const { lock } = await freshActions();
    await lock();
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(requireSession).not.toHaveBeenCalled();
  });
});
