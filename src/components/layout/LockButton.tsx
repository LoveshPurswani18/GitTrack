"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { lock } from "@/app/actions";

/**
 * Ends the session on this browser (DESIGN.md §6.12): the pass is deleted, then the whole page
 * is replaced (a full load, not a soft navigation), which drops every page the browser had kept
 * in memory.
 * A labelled button on desktop, a 44px icon on mobile.
 */
export function LockButton() {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await lock();
    } finally {
      // replace(), not push: the signed-in page leaves the history, so Back cannot return to it.
      window.location.replace(`${window.location.origin}/unlock`);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Lock GitTrack"
      className="text-label inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover disabled:opacity-50 sm:h-8 sm:w-auto sm:gap-2 sm:border sm:border-control-border sm:bg-bg sm:px-3 sm:text-text-primary"
    >
      <Lock size={16} strokeWidth={1.5} aria-hidden="true" className="sm:text-text-muted" />
      <span className="hidden sm:inline">Lock</span>
    </button>
  );
}
