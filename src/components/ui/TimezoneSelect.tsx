"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterZones, utcOffsetLabel, zoneOptions } from "@/lib/timezones";
import { cx } from "./cx";

export function TimezoneSelect({
  value,
  onChange,
  browserZone,
  className,
}: {
  value: string;
  onChange: (zone: string) => void;
  browserZone: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const { pinned, rest } = useMemo(() => zoneOptions(browserZone), [browserZone]);
  const visible = useMemo(() => {
    const q = query.trim();
    return q ? filterZones([...pinned, ...rest], q) : [...pinned, ...rest];
  }, [pinned, rest, query]);
  // Read when the list opens, never during render, so prerendering stays clock-free.
  const [now, setNow] = useState<Date | null>(null);

  function close(returnFocus: boolean) {
    setOpen(false);
    setQuery("");
    if (returnFocus) trigger.current?.focus();
  }

  function choose(zone: string) {
    onChange(zone);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  // Escape closes from anywhere inside the component (trigger or popover), back to the trigger.
  function onRootKeyDown(e: React.KeyboardEvent) {
    if (open && e.key === "Escape") {
      e.preventDefault();
      close(true);
    }
  }

  // Focus leaving the component (Tab out, window switch) closes the popover without stealing focus.
  function onRootBlur(e: React.FocusEvent) {
    if (open && !root.current?.contains(e.relatedTarget as Node | null)) close(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visible[active]) choose(visible[active]);
    }
  }

  return (
    <div
      ref={root}
      onKeyDown={onRootKeyDown}
      onBlur={onRootBlur}
      className={cx("relative", className)}
    >
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setActive(Math.max(0, [...pinned, ...rest].indexOf(value)));
          setNow(new Date());
          setOpen((o) => !o);
        }}
        className="text-label inline-flex h-9 w-full items-center gap-2 rounded-sm border border-control-border bg-bg px-3 text-text-primary hover:bg-surface-hover sm:h-8 sm:w-auto"
      >
        <Globe size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-text-muted" />
        <span className="truncate">{value}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="ml-auto shrink-0 text-text-muted sm:ml-0"
        />
      </button>
      {open && (
        <div
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 left-0 z-50 mt-1 min-w-60 rounded-md border border-border bg-surface p-1 shadow-popover sm:left-auto"
        >
          <input
            ref={search}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={visible[active] ? `${listId}-${active}` : undefined}
            aria-label="Search timezones"
            placeholder="Search timezones"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            className="text-body mb-1 h-8 w-full rounded-sm border border-control-border bg-bg px-2 text-text-primary placeholder:text-text-muted"
          />
          {/* tabIndex -1: clicking the list or an option moves focus inside the component, so the
              blur handler does not close the popover before the click lands. */}
          <ul
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label="Timezones"
            className="max-h-64 overflow-y-auto outline-none"
          >
            {visible.length === 0 && (
              <li className="text-body px-2 py-1.5 text-text-muted">No matching timezone</li>
            )}
            {visible.map((zone, i) => {
              const selected = zone === value;
              return (
                <li
                  key={zone}
                  id={`${listId}-${i}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  onClick={() => choose(zone)}
                  onMouseMove={() => setActive(i)}
                  className={cx(
                    "text-body flex cursor-pointer items-center justify-between gap-4 rounded-sm px-2 py-1.5",
                    selected ? "bg-accent-subtle text-accent-text" : "text-text-primary",
                    !selected && i === active && "bg-surface-hover",
                  )}
                >
                  <span className="truncate">{zone}</span>
                  <span
                    className={cx(
                      "text-metric-sm shrink-0",
                      selected ? "text-accent-text" : "text-text-muted",
                    )}
                  >
                    {utcOffsetLabel(zone, now ?? undefined)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
