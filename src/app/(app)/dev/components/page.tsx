// Dev-only page: every ui primitive in every state, with made-up data. Returns 404 in
// production. Kept through the build as a reference (docs/DESIGN.md §6, §12; docs/TASKS.md 2.1).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Showcase } from "./Showcase";

export const metadata: Metadata = { title: "Components" };

export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <h1 className="text-title">Components</h1>
      <p className="text-body text-text-secondary">
        Every ui primitive in every state, with made-up data. Not part of the product.
      </p>
      <Suspense fallback={<p className="text-body mt-8 text-text-muted">Loading…</p>}>
        <ShowcaseAtRequestTime />
      </Suspense>
    </main>
  );
}

// The clock is read per request and passed down, so the client component never calls new Date().
async function ShowcaseAtRequestTime() {
  await connection();
  return <Showcase nowIso={new Date().toISOString()} />;
}
