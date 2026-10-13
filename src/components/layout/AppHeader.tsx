"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-bg">
      <div className="mx-auto flex h-full max-w-[1024px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ink.svg" alt="" width={20} height={20} className="logo-ink" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.svg" alt="" width={20} height={20} className="logo-white" />
          <span className="text-heading">GitTrack</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`text-label rounded-sm px-3 py-1.5 ${
                  active
                    ? "bg-surface-hover text-text-primary"
                    : "text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-11 w-11 items-center justify-center rounded-full sm:h-7 sm:w-7"
          >
            <span className="h-7 w-7 rounded-full border border-border bg-surface-hover" />
          </Link>
        </div>
      </div>
    </header>
  );
}
