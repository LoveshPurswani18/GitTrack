"use client";

import { useEffect } from "react";

/**
 * After Lock, the Back button can restore the old page from the browser's back/forward cache
 * without asking the server. A page restored that way reloads at once, so it goes through the
 * gate again (and lands on the unlock screen if the pass is gone).
 */
export function BackForwardGuard() {
  useEffect(() => {
    const reloadIfRestored = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", reloadIfRestored);
    return () => window.removeEventListener("pageshow", reloadIfRestored);
  }, []);
  return null;
}
