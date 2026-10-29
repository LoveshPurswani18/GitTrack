import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Banner } from "@/components/ui/Banner";
import { getGate } from "@/lib/auth/gate";
import { UnlockForm } from "./UnlockForm";

export const metadata: Metadata = { title: "Unlock", robots: { index: false, follow: false } };

/**
 * The only page a visitor without a pass can see (DESIGN.md §7.4). It renders no activity data,
 * repo names or user details. If the gate is not configured, the proxy serves this page for every
 * route and it shows the generic unavailable message instead of the form.
 */
export default function UnlockPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-[1024px] flex-col items-center px-4 pt-[72px] pb-12 sm:pt-32">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ink.svg" alt="" width={28} height={28} className="logo-ink" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.svg" alt="" width={28} height={28} className="logo-white" />
        <span className="text-[20px] leading-7 font-semibold">GitTrack</span>
      </div>
      <div className="mt-6 w-full max-w-[360px] rounded-md border border-border bg-surface p-6 sm:p-8">
        <Suspense fallback={null}>
          <UnlockBody />
        </Suspense>
      </div>
    </main>
  );
}

async function UnlockBody() {
  await connection();
  if (!getGate().ready) {
    return (
      <Banner tone="danger" title="GitTrack is unavailable">
        This site isn&apos;t available right now. Try again later.
      </Banner>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[20px] leading-7 font-semibold">Unlock GitTrack</h1>
        <p className="text-body text-text-secondary">
          This dashboard is private. Sign in with your username and access key.
        </p>
      </div>
      <UnlockForm />
    </div>
  );
}
