"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { cx } from "./cx";

type Props = {
  label: string;
  /** Marks the field as wrong (red border, `aria-invalid`). */
  invalid?: boolean;
  /** The message under the field. Linked to the input with `aria-describedby`. */
  error?: string;
  /** A password field: hidden by default, with a show/hide button inside. */
  password?: boolean;
} & Omit<React.ComponentProps<"input">, "className" | "type" | "id">;

/** DESIGN.md §6.13: a 44px text field with its label above and an optional error message below. */
export function TextInput({ label, invalid, error, password, ...input }: Props) {
  const id = useId();
  const messageId = `${id}-error`;
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-text-primary">
        {label}
      </label>
      <div className="relative">
        <input
          {...input}
          id={id}
          type={password && !shown ? "password" : "text"}
          aria-invalid={invalid || error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          className={cx(
            "text-body h-11 w-full rounded-sm border bg-bg pl-3 text-text-primary",
            password ? "pr-11" : "pr-3",
            invalid || error ? "border-danger" : "border-control-border",
          )}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShown((value) => !value)}
            aria-label={shown ? "Hide key" : "Show key"}
            aria-pressed={shown}
            className="absolute top-1 right-1 flex h-9 w-9 items-center justify-center rounded-sm text-text-muted hover:bg-surface-hover"
          >
            {shown ? (
              <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={messageId} role="alert" className="text-label flex items-center gap-1.5 text-danger">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
