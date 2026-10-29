"use client";

import { cx } from "./cx";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx(
        "flex h-9 gap-0.5 rounded-sm border border-control-border bg-bg p-0.5 sm:h-8",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              "text-label flex-1 rounded-[4px] px-3 whitespace-nowrap sm:flex-none",
              selected
                ? "bg-accent-subtle text-accent-text"
                : "text-text-secondary hover:bg-surface-hover",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
