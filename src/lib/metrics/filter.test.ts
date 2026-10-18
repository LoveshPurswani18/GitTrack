import { describe, expect, it } from "vitest";
import { activity, commit, PERSONAL_REPO, pr, WORK_REPO_A, WORK_REPO_B } from "@/test/factories";
import { filterByScope } from "./filter";

const ORPHAN = "ghost-org/unknown";
const data = activity({
  commits: [
    commit(PERSONAL_REPO, "2026-10-13T10:00:00Z"),
    commit(WORK_REPO_A, "2026-10-13T11:00:00Z"),
    commit(WORK_REPO_B, "2026-10-13T12:00:00Z"),
    commit(ORPHAN, "2026-10-13T13:00:00Z"),
  ],
  pullRequests: [
    pr({ repo: PERSONAL_REPO, number: 1 }),
    pr({ repo: WORK_REPO_A, number: 2 }),
    pr({ repo: ORPHAN, number: 3 }),
  ],
});

describe("filterByScope", () => {
  it("work keeps only work repos", () => {
    const result = filterByScope(data, "work");
    expect(result.commits.map((c) => c.repo)).toEqual([WORK_REPO_A, WORK_REPO_B]);
    expect(result.pullRequests.map((p) => p.repo)).toEqual([WORK_REPO_A]);
    expect(result.repos.every((r) => r.isWork)).toBe(true);
  });

  it("personal keeps only non-work repos", () => {
    const result = filterByScope(data, "personal");
    expect(result.commits.map((c) => c.repo)).toEqual([PERSONAL_REPO]);
    expect(result.pullRequests.map((p) => p.repo)).toEqual([PERSONAL_REPO]);
  });

  it("all keeps every known repo", () => {
    expect(filterByScope(data, "all").commits).toHaveLength(3);
  });

  it("drops commits and PRs of unknown repos in every scope", () => {
    for (const scope of ["all", "personal", "work"] as const) {
      const result = filterByScope(data, scope);
      expect(result.commits.some((c) => c.repo === ORPHAN)).toBe(false);
      expect(result.pullRequests.some((p) => p.repo === ORPHAN)).toBe(false);
    }
  });

  it("all equals personal plus work", () => {
    const all = filterByScope(data, "all");
    const split = filterByScope(data, "personal").commits.length + filterByScope(data, "work").commits.length;
    expect(all.commits.length).toBe(split);
  });
});
