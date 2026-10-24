# GitTrack v2 — Design spec

The single source of truth for how GitTrack looks and behaves. Read this before any UI work. If the code and this file disagree, this file wins; if the design must change, change this file first, then the code.

- **Screens:** `docs/design/screens/*.png` (light and dark of every screen; see [Screen index](#13-screen-index)).
- **Logos:** `public/icon.svg`, `public/logo-ink.svg`, `public/logo-white.svg`.
- **Tokens:** section 3 lists every value. Generate `src/app/tokens.css` from it (section 3.6); never hand-pick values elsewhere.

---

## 1. Look and principles

GitTrack is a minimal developer tool: flat neutral surfaces, one green accent, numbers set in mono. Data is the hero; chrome stays quiet.

1. **Numbers first.** Every screen leads with a number in `metric-xl` or `metric`, with its label above it in `label` / `text-muted`.
2. **One accent.** Green (`accent`) means activity or the current selection. Nothing decorative uses colour. The one exception is PR status dots, which use GitHub's own open green and merged purple so they read the same as on github.com.
3. **Flat.** Solid `surface` with a 1px `border`. No card shadows, no blur, no gradients, no glass. `shadow-popover` is the only shadow.
4. **Honest data.** Never hide a zero, never animate a number into place, and always show the range and timezone near a value.
5. **Work is labelled, not hidden.** WhatBuilds repos and PRs show their real names and titles, followed by a "Work" tag.

## 2. Voice and copy

- Sentence case everywhere: "Current streak", "Commits by project", "Updated 4 min ago".
- State facts, not encouragement: "No commits today", never "Keep going!". No emoji, no exclamation marks.
- Use GitHub's words: commits, pull requests (PRs), repos, open, merged.
- Ranges read as "last 7 days", "last month", "last 6 months", "last 12 months", "today".
- Errors say what happened and what to do next ("Check GITHUB_TOKEN in the environment variables, then refresh").

---

## 3. Tokens

All colours have a light and a dark value. The light theme is the default; dark applies via `prefers-color-scheme: dark` and can be forced with `data-theme="light|dark"` on `<html>`.

### 3.1 Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#ffffff` | `#020617` | Page background |
| `surface` | `#f8fafc` | `#0f172a` | Cards, popovers. Always with a `border` edge |
| `surface-hover` | `#f1f5f9` | `#1e293b` | Hover fills, active nav item, bar tracks, avatar placeholder |
| `border` | `#e2e8f0` | `#1e293b` | Card edges, row dividers, badge and tag outlines. Decorative only |
| `control-border` | `#8492a6` | `#64748b` | Outline of segmented controls, select, secondary buttons (≥3:1) |
| `text-primary` | `#0f172a` | `#f8fafc` | Headings, numbers, body copy |
| `text-secondary` | `#475569` | `#cbd5e1` | Supporting copy, inactive segment labels, badge words |
| `text-muted` | `#64748b` | `#94a3b8` | Labels, captions, legends, tags (≥4.5:1 on `bg` and `surface`) |
| `accent` | `#15803d` | `#22c55e` | Primary button fill, streak icon, personal-repo bars and dots |
| `on-accent` | `#ffffff` | `#052e16` | Text and icons on an `accent` fill |
| `accent-text` | `#15803d` | `#4ade80` | Green text: selected segment label, positive deltas |
| `accent-subtle` | `#dcfce7` | `#052e16` | Selected segment fill, selected list option |
| `focus-ring` | `#15803d` | `#4ade80` | 2px solid keyboard focus ring, 2px offset |
| `danger` | `#b91c1c` | `#f87171` | Error text, icon and banner border |
| `danger-subtle` | `#fef2f2` | `#450a0a` | Error banner background |
| `warning` | `#b45309` | `#fbbf24` | Warning text, icon and banner border |
| `warning-subtle` | `#fffbeb` | `#451a03` | Warning banner background |
| `heat-0` | `#eef2f6` | `#1e293b` | Heatmap: no commits |
| `heat-1` | `#bbf7d0` | `#14532d` | Heatmap: 1st quartile |
| `heat-2` | `#4ade80` | `#15803d` | Heatmap: 2nd quartile |
| `heat-3` | `#16a34a` | `#22c55e` | Heatmap: 3rd quartile |
| `heat-4` | `#166534` | `#86efac` | Heatmap: top quartile |
| `series-personal` | `#15803d` | `#22c55e` | Personal repos in bars and legends |
| `series-work` | `#94a3b8` | `#475569` | Work repos in bars and legends |
| `pr-open` | `#1a7f37` | `#3fb950` | Open PR dot (always with the word "open"). GitHub's open green (Primer `fgColor-open`) |
| `pr-merged` | `#8250df` | `#ab7df8` | Merged PR dot (always with the word "merged"). GitHub's merged purple (Primer `fgColor-done`) |
| `skeleton` | = `surface-hover` | = `surface-hover` | Loading placeholder blocks |

Heatmap levels step in lightness (light → dark in the light theme, dark → light in the dark theme), so they read without relying on hue.

### 3.2 Type

Fonts: **Geist** for UI, **Geist Mono** for numbers. Load with `next/font` (the `geist` npm package, or `next/font/google`). Numbers always use `font-variant-numeric: tabular-nums`. Mono is for numbers and the `@username` handle only, never headings or the wordmark.

| Style | Font | Size / line | Weight | Extra | Use |
|---|---|---|---|---|---|
| `title` | Geist | 24 / 32 | 600 | −0.02em | Page title, one per page |
| `heading` | Geist | 16 / 24 | 600 | | Card headings |
| `body` | Geist | 14 / 20 | 400 | | Default text |
| `label` | Geist | 13 / 18 | 500 | | Stat labels, buttons, segment options, nav |
| `caption` | Geist | 12 / 16 | 400 | | Legends, timestamps, helper lines |
| `tag` | Geist | 11 / 16 | 500 | | The "Work" tag only |
| `metric-xl` | Geist Mono | 36 / 40 | 500 | −0.02em | Stat card number (desktop) |
| `metric-lg` | Geist Mono | 28 / 34 | 500 | | Stat card number (mobile) |
| `metric` | Geist Mono | 20 / 28 | 500 | | Profile counts, secondary numbers |
| `metric-sm` | Geist Mono | 13 / 18 | 500 | | Counts in lists and badges |

Nothing smaller than 11px, and 11px only for the tag.

### 3.3 Spacing (4px grid)

| Token | Value | Typical use |
|---|---|---|
| `space-1` | 4px | Label to number in a stat card, icon to text in a label |
| `space-2` | 8px | Inside controls, between badges, name to tag |
| `space-3` | 12px | List row padding (vertical), control bar gap |
| `space-4` | 16px | Card padding and page gutter on mobile, stat grid gap on desktop |
| `space-6` | 24px | Card padding (desktop), gap between page sections |
| `space-8` | 32px | Profile card padding and gaps |
| `space-12` | 48px | Bottom padding of the page |

Desktop page body: 40px top, 48px bottom. Stat cards use 20px × 24px padding on desktop and 16px on mobile.

### 3.4 Radius, borders, shadow

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 6px | Buttons, controls, badges, tags. Segment options inside a control use 4px |
| `radius-md` | 10px | Cards, banners, popovers |
| `radius-full` | 9999px | Avatars, status dots, bars |
| Heatmap cell | 2px | Fixed |
| Border | 1px | Every edge |
| `shadow-popover` | light `0 8px 24px rgba(15,23,42,.12)`, dark `0 8px 24px rgba(0,0,0,.6)` | Open timezone list and tooltips only |

### 3.5 Sizes and layers

| Token | Value |
|---|---|
| `control-height` | 32px (36px on mobile) |
| `header-height` | 56px |
| `content-max` | 1024px, centred, 24px side padding (16px on mobile) |
| `heatmap-cell` | 12px with 3px gap (10px with 2px gap under 640px) |
| `avatar-sm` / `avatar-lg` | 28px / 96px |
| Touch targets | ≥44px on mobile (icon buttons are 44px wide) |
| Breakpoints | `sm` 640px, `md` 768px, `lg` 1024px |
| z-index | header 40, popover 50, tooltip 60 |

### 3.6 Implementing the tokens

Generate `src/app/tokens.css` from section 3 as CSS custom properties:

```css
:root { --bg: #ffffff; --surface: #f8fafc; /* …every colour token, light value */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #020617; /* …dark values */ }
}
:root[data-theme="dark"] { --bg: #020617; /* …dark values */ }
```

Then expose them to Tailwind v4 in `globals.css` with `@theme inline { --color-bg: var(--bg); --color-surface: var(--surface); … }`, plus `--font-sans`, `--font-mono`, `--radius-sm/md`, so components use classes like `bg-surface`, `text-text-muted`, `border-control-border`, `font-mono`. Never write a raw hex or an off-scale px value in a component.

---

## 4. Logo

The mark is a 3×3 grid of heatmap cells with a rising diagonal streak.

| File | Use |
|---|---|
| `public/icon.svg` | Favicon and app icon: white cells on an `accent` tile. Set as `app/icon.svg` or in `metadata.icons` |
| `public/logo-ink.svg` | Header mark on the light theme |
| `public/logo-white.svg` | Header mark on the dark theme |

Header lockup: mark at 20px, `space-2` gap, "GitTrack" in Geist 600 16px. Below 16px, use the app icon. Never recolour individual cells or redraw the mark.

## 5. Icons

[Lucide](https://lucide.dev) (`lucide-react`), 16px, stroke width 1.5, coloured by context (`text-muted` in labels and controls, `accent` for the streak flame, `danger` / `warning` in banners). Icons used: `Moon` / `Sun` (theme), `Globe`, `ChevronDown`, `RefreshCw`, `Flame`, `MapPin`, `Building`, `Calendar`, `ExternalLink`, `Copy` / `Check` (copy username), `Clock` (rate limit), `CircleAlert` (error). Icon-only buttons need an `aria-label`. No emoji.

---

## 6. Components

Build these in `src/components/ui/` with these names, then assemble pages from them. A `/dev/components` page shows each one in every state, light and dark.

### 6.1 Button
- 32px tall, 12px horizontal padding, `radius-sm`, `label` style, optional 16px leading or trailing icon with an 8px gap.
- **Primary:** `accent` fill, `on-accent` text. At most one per screen ("View on GitHub").
- **Secondary:** `bg` fill, 1px `control-border`, `text-primary`. Hover `surface-hover`. Used for Refresh, Try again and the theme toggle (32×32 icon-only).
- **Ghost:** no fill, `text-secondary`; hover `surface-hover`.
- **Disabled / busy:** 50% opacity, `cursor: not-allowed`, label changes ("Refreshing…").

### 6.2 SegmentedControl
- One outlined group: 1px `control-border`, `radius-sm`, 2px inner padding, 2px gap between options, `bg` fill. 32px tall (36px on mobile).
- Options: `label` style, 12px horizontal padding, 4px radius, `text-secondary`; hover `surface-hover`.
- **Selected:** `accent-subtle` fill and `accent-text` label. **Colour change only**: no underline, border or shadow.
- Markup: `role="group"` + `aria-label` on the wrapper; each option a `<button aria-pressed>`.
- Range: `Today · 1W · 1M · 6M · 1Y` (default 6M). Repos: `All · Personal · Work` (default All).
- On mobile both controls are full width with equal-width options. Never wrap.
- Persist the selection in the URL: `?range=6m&repos=work&tz=Asia/Kolkata`.

### 6.3 TimezoneSelect
- Trigger: secondary-style outline, 32px, `Globe` icon + zone name + `ChevronDown`, both icons `text-muted`. On mobile it fills the row next to a 44px icon-only Refresh button.
- Popover: `surface`, 1px `border`, `radius-md`, `shadow-popover`, 4px padding, min 240px wide, z 50.
- Rows: zone name left, current UTC offset right in mono `text-muted` (e.g. `UTC+5:30`). Selected row `accent-subtle` / `accent-text`.
- Pinned first: the browser's zone, `Asia/Kolkata`, `UTC`. Then a search field and all IANA zones alphabetically.
- Default: the browser's timezone. Changing it regroups days instantly, with no refetch.

### 6.4 StatCard
- `surface` card, 1px `border`, `radius-md`, padding 20 × 24px (16px on mobile), 4px vertical gap.
- Label (`label`, `text-muted`, optional 16px icon), value (`metric-xl` desktop / `metric-lg` mobile, `text-primary`), optional unit in `body` `text-muted` with a 4px gap, context line in `caption` `text-muted`.
- Deltas: the number in mono 500 `accent-text` ("**+12** vs last week"). A negative delta stays `text-muted` with a minus sign, never red.
- Zero: show `0` in `text-muted` with a factual line ("No commits yet today").
- The four cards: **Commits today** ("so far, {tz}") · **Commits this week** (delta vs last week) · **Current streak** (`Flame` in `accent`, unit "days", "Longest: N days") · **Total commits** (range label).
- Grid: 4 across on desktop (`repeat(auto-fit, minmax(200px, 1fr))`, 16px gap); 2 × 2 on mobile (12px gap), with shorter labels: Today, This week, Streak, Total.

### 6.5 Heatmap (inside the Activity card)
- Card header: "Activity" (`heading`) left; caption right: "{total} commits · {range label} · {timezone}".
- Grid: columns are weeks and rows are weekdays, Monday first. 12px cells, 3px gap, 2px radius (10px / 2px on mobile). Scrolls horizontally inside the card when wider.
- Colour: `heat-0` for zero; `heat-1`…`heat-4` by quartile of the **active days in the shown range** (like GitHub), so quiet periods still show contrast.
- Today's cell: 1.5px `text-primary` outline, 1px offset.
- Days are grouped in the selected timezone from UTC timestamps.
- Footer: left caption "Levels are quartiles of your active days in this range." (desktop only); right legend "Less ▢▢▢▢▢ More" with 10px swatches.
- Range layouts: ranges are rolling days ending today, so the columns are the weeks the range touches: 1Y = 53–54; 6M = 26–27; 1M = 5–6; 1W = 1–2; Today = 1. Days outside the range are left empty.
- Tooltip on hover and keyboard focus: "6 commits · Tue, 14 Oct" (`surface`, `border`, `shadow-popover`, z 60).

### 6.6 PRBadge and the Pull requests card
- Badge: 24px tall, 8px padding, 1px `border`, `radius-sm`, `bg` fill, `caption` `text-secondary`; count in `metric-sm` `text-primary`; optional 8px dot with a 6px gap.
- Summary row: `● N open` (`pr-open`) · `● N merged` (`pr-merged`) · `N opened in range` (no dot; just "opened" on mobile).
- List: newest first, up to 5 rows, separated by 1px `border` lines, 12px vertical padding. Each row shows the title (`body`, truncated with an ellipsis, plus the Work tag for work PRs), a meta line "{repo} · {d MMM}" in `caption` `text-muted`, and a status badge on the right.
- The Repos filter applies to the counts and the list.

### 6.7 ProjectList (Commits by project card)
- Header: "Commits by project" (`heading`); legend right: `● Personal` (`series-personal`) · `● Work` (`series-work`), `caption` `text-muted`.
- Row grid: name | bar | count = `minmax(0,1fr) 120px 56px` on desktop, `… 96px 48px` on mobile; 12px gap and padding; 1px `border` between rows.
- Name: real repo name in `body` `text-primary`, truncated; work repos add the Work tag after it with an 8px gap.
- Bar: 6px tall, `radius-full`, `surface-hover` track, filled `series-personal` or `series-work`, width relative to the top row.
- Count: `metric-sm`, right-aligned.
- Sorted by count, descending. Show the top 8, then a ghost "Show all" button. The Repos filter narrows the rows.

### 6.8 Work tag
- 18px tall, 6px horizontal padding, 1px `border`, `radius-sm`, `tag` style (11px / 500), `text-muted`, no fill, `white-space: nowrap`.
- Text is always "Work". It follows work repo names and work PR titles. It is the marker for work items; the grey bar alone is not enough.

### 6.9 Banner
- Full content width, 12 × 16px padding, `radius-md`, 1px border in the status colour, a 16px icon at the top left with a 12px gap.
- Title in 600 status colour; detail line below in `text-secondary`.
- **Warning** (`warning` / `warning-subtle`, `Clock`, `role="status"`): rate limit reached, stale data. Cached data stays visible below it.
- **Danger** (`danger` / `danger-subtle`, `CircleAlert`, `role="alert"`): token missing or rejected, GitHub unreachable.
- Sits directly under the page title, above the controls' content.

### 6.10 Skeleton
- `skeleton` blocks with 6px radius in the exact shape of the content (stat card: 110×14, 72×36, 120×12; heatmap: a heading bar plus a 102px block). They pulse softly: opacity 1 → 0.5 → 1 over 1.6s, ease-in-out, looping. No shimmer or gradient sweep. Under `prefers-reduced-motion` they are static.
- Wrap the loading region in `aria-busy="true"` with an `aria-label`.

### 6.11 ProfileCard
- `surface` card, 1px `border`, `radius-md`, 32px padding, 32px gap, wraps on small screens.
- Avatar: 96px circle with a 1px `border` (the GitHub avatar image; an initial on `surface-hover` as fallback). 64px and stacked above the text on mobile.
- Name (`title`), `@login` (mono 14px `text-muted`; a button that copies the login, without the `@`, to the clipboard, with a `Copy` icon that becomes a `Check` for 1.5 s), bio (`body` `text-secondary`; hidden if empty).
- Meta row (13px `text-secondary`, 20px gaps): `MapPin` location · `Building` company · `Calendar` "Joined Mon YYYY"; icons 16px `text-muted`. Hide empty fields.
- Counts: Followers · Following · Public repos, as a `caption` label over a `metric` number, 32px apart.
- Primary button "View on GitHub" + `ExternalLink`, linking to `html_url` in a new tab (`rel="noopener noreferrer"`).
- Caption under the card: "Public profile data from GitHub · Updated N min ago".

### 6.12 App header
- 56px tall, 1px bottom `border`, `bg` fill, sticky (z 40); inner row max 1024px.
- Left: logo lockup linking to `/`. Then nav (desktop): Dashboard, Profile as 13px/500 links, 6 × 12px padding, `radius-sm`. Active = `surface-hover` fill + `text-primary` + `aria-current="page"`; inactive = `text-secondary`.
- Right: theme toggle (secondary icon button, `Moon` in light, `Sun` in dark) and a 28px avatar.
- Mobile: no nav links; the avatar links to Profile; the theme toggle is a 44px ghost icon button.

---

## 7. Screens and layout

### 7.1 Dashboard (`/`)
Top to bottom, in a 1024px column with 24px gaps between sections:
1. Header.
2. Title row: "Activity" (`title`) + "Commits and pull requests across personal and work repos." (`body` `text-secondary`); "Updated N min ago" (`caption`) aligned right on desktop, under the title on mobile.
3. Banner, if any.
4. Control bar: Range control, Repos control, flexible spacer, TimezoneSelect, Refresh. Wraps on narrow screens. On mobile it stacks: range, repos, then timezone + refresh.
5. Stat cards row.
6. Activity card (heatmap).
7. Pull requests card and Commits by project card, side by side (`flex: 1 1 380px` each, 24px gap); stacked on mobile.

### 7.2 Profile (`/profile`)
Header → "Profile" title → ProfileCard → caption. Same column and gaps.

### 7.3 Mobile (under 640px)
Single column, 16px gutters, 16px gaps; the changes listed per component above. The mobile mockups are 390px wide.

---

## 8. States

| State | What shows |
|---|---|
| Loading (first load, no cache) | Header, title, controls, then Skeletons for the stat row and Activity card |
| Refreshing (cache present) | Current data stays; Refresh shows "Refreshing…" disabled; no skeletons |
| Empty range | Stat cards with `0` in `text-muted` and factual lines; Activity card body: "No commits in the last 7 days" (600) + "Try a longer range, like 6 months." (`text-secondary`), centred |
| Rate limit | Warning banner with cache time and reset time; cached data below, context lines say "cached at HH:MM" |
| Token error, no cache | Danger banner + a centred card: "No data to show" / explanation / secondary "Try again" button |
| Token error with cache | Danger banner + cached data |
| Profile fetch failed | Danger banner on the profile page; the card is not shown |

## 9. Interaction and motion

- Transitions: only 150ms ease-out (hover, focus, colour) and 250ms ease-out (popover open). Respect `prefers-reduced-motion`.
- Data never animates: no count-ups, no drawing in, no hover scaling. The one exception is the skeleton pulse (§6.10), which is a loading placeholder, not data.
- Hover: `surface-hover` on interactive surfaces; links dim slightly.
- Changing range, repos or timezone updates everything instantly from cached events; only Refresh refetches.
- Theme: follows the system by default; the toggle sets `data-theme` on `<html>` and saves it in `localStorage`.

## 10. Accessibility

- Text contrast ≥4.5:1 in both themes (all token pairs above meet this on `bg` and `surface`); control borders and focus rings ≥3:1.
- Every interactive element is a real `<button>` or `<a>` with a visible focus ring: 2px solid `focus-ring`, 2px offset.
- Selection is exposed with `aria-pressed` (segments), `aria-selected` (list options) and `aria-current` (nav).
- Status is never colour-only: PR status has words, work items have the Work tag, banners have icons and titles.
- The heatmap has an `aria-label`, and each cell has an accessible name like "6 commits on Tue, 14 Oct".
- Mobile touch targets ≥44px.

## 11. Do and don't

| Do | Don't |
|---|---|
| Use token classes only | Raw hex, arbitrary px, `shadow-*` on cards, blur, gradients |
| Mono + tabular numbers for every count | Mono for headings, labels or the wordmark |
| Colour change for the selected segment | Underlines, borders or shadows on the selected segment |
| Real repo and PR names, with the Work tag on work items | Hiding work items or marking them by colour alone |
| Show zeros plainly | Hiding empty cards or showing "—" for zero |
| Keep the range and timezone visible near numbers | Unlabelled numbers |
| Lucide icons, 16px | Emoji, custom icon sets, filled icons |

## 12. Verifying a UI change

1. Compare the page against its PNG in `docs/design/screens/` at the same width (1280 or 390), in light and dark. Ignore the differences listed under "Known differences" in section 13.
2. Check every state the component can be in (`/dev/components`).
3. Tab through the page: every control is reachable and shows the focus ring.
4. Search the diff for hex colours, `shadow`, `blur` and off-scale spacing; there should be none outside `tokens.css`.

With the Playwright MCP, ask Claude Code to screenshot the page at 1280×800 and 390×844 in both themes and compare them against the PNGs. Claude Code always runs these checks with `GITHUB_DATA=fixtures`, so work names in its screenshots are the made-up fixture ones.

## 13. Screen index

The screens use sample data. Text in square brackets is a placeholder (work repo names, PR titles, bio, join date) and comes from GitHub in the app.

| File | Screen |
|---|---|
| `dashboard-desktop-light.png` / `-dark.png` | Dashboard, 1280px, range 6M, All repos |
| `dashboard-mobile-light.png` / `-dark.png` | Dashboard, 390px |
| `profile-desktop-light.png` / `-dark.png` | Profile, 1280px |
| `state-loading-light.png` / `-dark.png` | First load, skeletons (content area) |
| `state-empty-light.png` / `-dark.png` | Empty range (1W, no commits) |
| `state-rate-limit-light.png` / `-dark.png` | Rate limit with cached data |
| `state-token-error-light.png` / `-dark.png` | Token rejected, no cache |

The state screens show the content area only; the header and controls are the same as on the dashboard.

**Known differences (the PNGs are not re-exported; the tokens in section 3 win):**
- PR status dots: the PNGs show blue (open) and purple (merged) from the first design. The app uses GitHub's own colours: green `pr-open` and purple `pr-merged` (section 3.1). When comparing a screenshot with `dashboard-*` or `state-*`, a green open dot and a slightly different purple merged dot are expected, not a mismatch.
- Skeleton pulse: `state-loading-*` is a still image. In the app the skeleton blocks pulse softly (section 6.10).

The live, clickable mockups and the design system are in Claude Design (GitTrack v2 Screens, GitTrack design system). Update those first when the design changes, then re-export the PNGs and this file.
