import { describe, expect, it } from "vitest";
import type { Cell } from "@/lib/metrics/heatmap";
import { nextCell } from "./heatmapNav";

const cell = (day: string): Cell => ({ day, count: 0, level: 0 });

// Three week columns. Week 0 starts on Wednesday (Mon, Tue empty); week 2 ends on Tuesday.
const weeks: (Cell | null)[][] = [
  [null, null, cell("a"), cell("b"), cell("c"), cell("d"), cell("e")],
  [cell("f"), cell("g"), cell("h"), cell("i"), cell("j"), cell("k"), cell("l")],
  [cell("m"), cell("n"), null, null, null, null, null],
];

describe("nextCell", () => {
  it("moves a day down and up inside a week", () => {
    expect(nextCell(weeks, { w: 1, d: 2 }, "ArrowDown")).toEqual({ w: 1, d: 3 });
    expect(nextCell(weeks, { w: 1, d: 2 }, "ArrowUp")).toEqual({ w: 1, d: 1 });
  });

  it("crosses into the neighbouring week at the week edge", () => {
    expect(nextCell(weeks, { w: 1, d: 6 }, "ArrowDown")).toEqual({ w: 2, d: 0 });
    expect(nextCell(weeks, { w: 1, d: 0 }, "ArrowUp")).toEqual({ w: 0, d: 6 });
  });

  it("moves a week left and right in the same weekday row", () => {
    expect(nextCell(weeks, { w: 1, d: 3 }, "ArrowRight")).toBeNull();
    expect(nextCell(weeks, { w: 0, d: 3 }, "ArrowRight")).toEqual({ w: 1, d: 3 });
    expect(nextCell(weeks, { w: 1, d: 3 }, "ArrowLeft")).toEqual({ w: 0, d: 3 });
  });

  it("stays put when the target is outside the range", () => {
    expect(nextCell(weeks, { w: 1, d: 0 }, "ArrowLeft")).toBeNull();
    expect(nextCell(weeks, { w: 1, d: 5 }, "ArrowRight")).toBeNull();
    expect(nextCell(weeks, { w: 0, d: 2 }, "ArrowUp")).toBeNull();
    expect(nextCell(weeks, { w: 2, d: 1 }, "ArrowDown")).toBeNull();
  });

  it("jumps to the first and last day with Home and End", () => {
    expect(nextCell(weeks, { w: 1, d: 3 }, "Home")).toEqual({ w: 0, d: 2 });
    expect(nextCell(weeks, { w: 1, d: 3 }, "End")).toEqual({ w: 2, d: 1 });
  });

  it("handles a single-week range and an empty grid", () => {
    const one: (Cell | null)[][] = [[cell("x"), null, null, null, null, null, null]];
    expect(nextCell(one, { w: 0, d: 0 }, "ArrowDown")).toBeNull();
    expect(nextCell(one, { w: 0, d: 0 }, "End")).toEqual({ w: 0, d: 0 });
    expect(nextCell([], { w: 0, d: 0 }, "Home")).toBeNull();
  });
});
