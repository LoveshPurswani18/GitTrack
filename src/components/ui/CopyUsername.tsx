"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "copied" | "failed";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // navigator.clipboard only exists on secure pages, so a dev server opened by IP address (for
    // example from a phone) needs the older route.
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.appendChild(field);
  // Focus first, then select the whole text: iOS Safari ignores select() on an unfocused field.
  field.focus();
  field.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    previous?.focus();
  }
}

/**
 * The `@login` line on the profile card. Clicking it copies the login (without the `@`) to the
 * clipboard; the copy icon turns into a check for a moment, and a screen reader hears the result.
 */
export function CopyUsername({ login }: { login: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const copied = await copyText(login);
    setStatus(copied ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 1500);
  }

  return (
    <span className="inline-flex">
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy username ${login}`}
        // The extra padding makes a 44px tap target on mobile without moving anything.
        className="inline-flex items-center gap-1.5 rounded-sm font-mono text-[14px] leading-5 text-text-muted hover:text-text-primary -my-3 py-3 sm:my-0 sm:py-0"
      >
        @{login}
        {status === "copied" ? (
          <Check size={16} strokeWidth={1.5} aria-hidden="true" className="text-accent-text" />
        ) : (
          <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
      <span role="status" className="sr-only">
        {status === "copied" ? "Username copied" : status === "failed" ? "Could not copy" : ""}
      </span>
    </span>
  );
}
