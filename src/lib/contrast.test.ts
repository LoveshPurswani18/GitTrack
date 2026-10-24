import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/tokens.css"), "utf8");

/** Token values from the first `selector { … }` block, with `var(--x)` resolved. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in tokens.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[name] = value.trim();
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  light: tokens(":root"),
  dark: tokens(':root[data-theme="dark"]'),
};

// DESIGN.md §10: text ≥ 4.5:1 on bg and surface; control borders and the focus ring ≥ 3:1.
describe.each(Object.entries(themes))("%s theme contrast", (_, t) => {
  const text = ["text-primary", "text-secondary", "text-muted", "accent-text", "danger", "warning"];

  it.each(text.flatMap((fg) => ["bg", "surface"].map((bg) => [fg, bg])))(
    "%s on %s is at least 4.5:1",
    (fg, bg) => {
      expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([["bg"], ["surface"]])("control-border on %s is at least 3:1", (bg) => {
    expect(ratio(t["control-border"], t[bg])).toBeGreaterThanOrEqual(3);
  });

  it.each([["bg"], ["surface"]])("focus-ring on %s is at least 3:1", (bg) => {
    expect(ratio(t["focus-ring"], t[bg])).toBeGreaterThanOrEqual(3);
  });

  it("on-accent text on the accent fill is at least 4.5:1", () => {
    expect(ratio(t["on-accent"], t["accent"])).toBeGreaterThanOrEqual(4.5);
  });
});
