"use client";

import { Moon, Sun } from "lucide-react";

function toggleTheme() {
  const root = document.documentElement;
  const explicit = root.getAttribute("data-theme");
  const isDark =
    explicit === "dark" ||
    (explicit !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const next = isDark ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {}
}

// Both icons render; CSS shows the one for the effective theme (no hydration mismatch).
export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover sm:h-8 sm:w-8 sm:border sm:border-control-border sm:bg-bg sm:text-text-primary"
    >
      <Moon size={16} strokeWidth={1.5} className="theme-icon-light" aria-hidden="true" />
      <Sun size={16} strokeWidth={1.5} className="theme-icon-dark" aria-hidden="true" />
    </button>
  );
}
