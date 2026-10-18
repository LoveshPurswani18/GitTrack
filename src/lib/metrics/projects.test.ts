import { describe, expect, it } from "vitest";
import { activity, commit, PERSONAL_REPO, WORK_REPO_A, WORK_REPO_B } from "@/test/factories";
import { commitsByRepo } from "./projects";
import { filterByScope } from "./filter";

const bounds = { start: "2026-10-08", end: "2026-10-14" };
const data = activity({
  commits: [
    commit(PERSONAL_REPO, "2026-10-13T10:00:00Z"),
    commit(WORK_REPO_A, "2026-10-13T10:00:00Z"),
    commit(WORK_REPO_A, "2026-10-12T10:00:00Z"),
    commit(WORK_REPO_B, "2026-10-12T10:00:00Z"),
    commit(WORK_REPO_B, "2026-09-01T10:00:00Z"), // outside range
    commit("ghost-org/unknown", "2026-10-13T10:00:00Z"),
  ],
});

describe("commitsByRepo", () => {
  it("sorts by count desc then name, with url and isWork", () => {
    const result = commitsByRepo(data, "UTC", bounds);
    expect(result.map((r) => [r.repo, r.count])).toEqual([
      [WORK_REPO_A, 2],
      [PERSONAL_REPO, 1],
      [WORK_REPO_B, 1],
    ]);
    expect(result[0]).toMatchObject({ isWork: true, url: `https://github.com/${WORK_REPO_A}` });
    expect(result[1].isWork).toBe(false);
  });

  it("skips repos that are not in activity.repos", () => {
    expect(commitsByRepo(data, "UTC", bounds).some((r) => r.repo === "ghost-org/unknown")).toBe(false);
  });

  it("returns nothing for an empty range", () => {
    expect(commitsByRepo(data, "UTC", { start: "2026-01-01", end: "2026-01-02" })).toEqual([]);
  });

  it("uses the selected timezone at the range edge", () => {
    const late = activity({ commits: [commit(PERSONAL_REPO, "2026-10-07T19:30:00Z")] }); // 01:00 IST on 8 Oct
    expect(commitsByRepo(late, "Asia/Kolkata", bounds)).toHaveLength(1);
    expect(commitsByRepo(late, "UTC", bounds)).toEqual([]);
  });

  it("personal plus work equals all", () => {
    const sum = (scope: "all" | "personal" | "work") =>
      commitsByRepo(filterByScope(data, scope), "UTC", bounds).reduce((n, r) => n + r.count, 0);
    expect(sum("personal") + sum("work")).toBe(sum("all"));
  });
});
