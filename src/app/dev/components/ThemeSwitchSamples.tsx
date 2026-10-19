"use client";

// DEV ONLY: design options for the header theme control, for review. Selection here is local
// state and does not change the page theme (use the header toggle for that). Nothing in
// src/components/ui or the real header uses this; the chosen option gets built properly later.
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type Size = "desktop" | "mobile";
type Mode = "system" | "light" | "dark";

const CELL: Record<Size, string> = { desktop: "h-7 w-7", mobile: "h-11 w-11" };

const MODES: { value: Mode; label: string; Icon: LucideIcon }[] = [
  { value: "system", label: "Follow system theme", Icon: Monitor },
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
];

// Options B and C: one outlined group, icon-only options, selected = colour change only.
function IconSegments({
  modes,
  value,
  onChange,
  size,
}: {
  modes: typeof MODES;
  value: Mode;
  onChange: (m: Mode) => void;
  size: Size;
}) {
  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex gap-0.5 rounded-sm border border-control-border bg-bg p-0.5"
    >
      {modes.map(({ value: v, label, Icon }) => {
        const selected = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onChange(v)}
            className={cx(
              "inline-flex items-center justify-center rounded-[4px]",
              CELL[size],
              selected ? "bg-accent-subtle text-accent-text" : "text-text-secondary hover:bg-surface-hover",
            )}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

// Option A: classic switch. The highlighted cell is a "knob" that slides between Light and Dark.
// The slide is a 150ms transform, which DESIGN.md §9 does not currently allow.
function SlidingSwitch({
  dark,
  onChange,
  size,
}: {
  dark: boolean;
  onChange: (dark: boolean) => void;
  size: Size;
}) {
  const travel = size === "desktop" ? "translate-x-7.5" : "translate-x-11.5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      onClick={() => onChange(!dark)}
      className="relative inline-flex gap-0.5 rounded-sm border border-control-border bg-bg p-0.5"
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute top-0.5 left-0.5 rounded-[4px] bg-accent-subtle transition-transform duration-150 ease-out",
          CELL[size],
          dark ? travel : "translate-x-0",
        )}
      />
      {[Sun, Moon].map((Icon, i) => {
        const active = (i === 1) === dark;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={cx(
              "relative inline-flex items-center justify-center",
              CELL[size],
              active ? "text-accent-text" : "text-text-muted",
            )}
          >
            <Icon size={16} strokeWidth={1.5} />
          </span>
        );
      })}
    </button>
  );
}

// Option D (from the reference image): pill track in the inverse colour of the page, round knob
// that carries the current icon and slides between the ends. Track uses text-primary and the
// knob bg, so on a light page it reads dark-track/white-knob and on a dark page the reverse.
// Flat: the reference's drop shadow is left out (DESIGN.md allows no shadows besides popovers).
const PILL: Record<Size, { track: string; knob: string; travel: string }> = {
  desktop: { track: "h-8 w-14", knob: "h-6 w-6", travel: "translate-x-6" },
  mobile: { track: "h-11 w-20", knob: "h-9 w-9", travel: "translate-x-9" },
};

function PillSwitch({
  dark,
  onChange,
  size,
}: {
  dark: boolean;
  onChange: (dark: boolean) => void;
  size: Size;
}) {
  const { track, knob, travel } = PILL[size];
  const Icon = dark ? Moon : Sun;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      onClick={() => onChange(!dark)}
      className={cx("relative inline-flex shrink-0 items-center rounded-full bg-text-primary p-1", track)}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-flex items-center justify-center rounded-full bg-bg text-text-primary transition-transform duration-150 ease-out",
          knob,
          dark ? travel : "translate-x-0",
        )}
      >
        <Icon size={16} strokeWidth={1.5} />
      </span>
    </button>
  );
}

// A 390px-wide stand-in for the app header, to judge how tight the control is on mobile.
function MobileHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-14 w-full max-w-sm items-center gap-2 border border-border bg-bg px-4">
      <span aria-hidden="true" className="h-5 w-5 rounded-[2px] bg-text-primary" />
      <span className="text-heading">GitTrack</span>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <span aria-hidden="true" className="h-11 w-11 rounded-full p-2">
          <span className="block h-7 w-7 rounded-full border border-border bg-surface-hover" />
        </span>
      </div>
    </div>
  );
}

function Option({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4 sm:p-6">
      <h3 className="text-heading">{title}</h3>
      <p className="text-caption mb-4 text-text-muted">{note}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-text-muted">{label}</span>
      {children}
    </div>
  );
}

export function ThemeSwitchSamples() {
  const [aDark, setADark] = useState(false);
  const [b, setB] = useState<Mode>("light");
  const [c, setC] = useState<Mode>("system");
  const [dDark, setDDark] = useState(false);
  const twoModes = MODES.filter((m) => m.value !== "system");

  return (
    <>
      <p className="text-caption text-text-muted">
        For review only. Clicking here changes the sample, not the page theme. Switch the header toggle to
        see each option in light and dark.
      </p>

      <Option
        title="A. Sliding switch"
        note="Two states (light, dark). Knob slides on a 150ms transform, which DESIGN.md §9 does not allow today. No system option."
      >
        <Labelled label="Desktop size (28px cells)">
          <div>
            <SlidingSwitch dark={aDark} onChange={setADark} size="desktop" />
          </div>
        </Labelled>
        <Labelled label="Mobile size (44px cells)">
          <MobileHeader>
            <SlidingSwitch dark={aDark} onChange={setADark} size="mobile" />
          </MobileHeader>
        </Labelled>
      </Option>

      <Option
        title="B. Two segments"
        note="Light and Dark only. Same pattern as the Range and Repos controls: selected = colour change only. No system option."
      >
        <Labelled label="Desktop size (28px cells)">
          <div>
            <IconSegments modes={twoModes} value={b} onChange={setB} size="desktop" />
          </div>
        </Labelled>
        <Labelled label="Mobile size (44px cells)">
          <MobileHeader>
            <IconSegments modes={twoModes} value={b} onChange={setB} size="mobile" />
          </MobileHeader>
        </Labelled>
      </Option>

      <Option
        title="C. Three segments (recommended)"
        note="System, Light and Dark. Same pattern as B, and the only option that can return to following the system."
      >
        <Labelled label="Desktop size (28px cells)">
          <div>
            <IconSegments modes={MODES} value={c} onChange={setC} size="desktop" />
          </div>
        </Labelled>
        <Labelled label="Mobile size (44px cells)">
          <MobileHeader>
            <IconSegments modes={MODES} value={c} onChange={setC} size="mobile" />
          </MobileHeader>
        </Labelled>
      </Option>

      <Option
        title="D. Pill switch with knob icon (your reference)"
        note="Two states (light, dark). The track is the inverse colour of the page and the round knob carries the current icon. Knob slides on a 150ms transform, like A. Drop shadow from the reference is left out. No system option."
      >
        <Labelled label="Both states, desktop size (left: light, right: dark; not clickable)">
          <div inert className="flex items-center gap-4">
            <PillSwitch dark={false} onChange={() => {}} size="desktop" />
            <PillSwitch dark onChange={() => {}} size="desktop" />
          </div>
        </Labelled>
        <Labelled label="Both states, mobile size (44px tall; not clickable)">
          <div inert className="flex items-center gap-4">
            <PillSwitch dark={false} onChange={() => {}} size="mobile" />
            <PillSwitch dark onChange={() => {}} size="mobile" />
          </div>
        </Labelled>
        <Labelled label="Desktop size (clickable)">
          <div>
            <PillSwitch dark={dDark} onChange={setDDark} size="desktop" />
          </div>
        </Labelled>
        <Labelled label="Mobile size in a 390px header (clickable)">
          <MobileHeader>
            <PillSwitch dark={dDark} onChange={setDDark} size="mobile" />
          </MobileHeader>
        </Labelled>
      </Option>
    </>
  );
}
