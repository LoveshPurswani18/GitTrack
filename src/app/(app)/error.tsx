"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";

/**
 * The fallback for failures that are not a GitHub state: a bad configuration or a bug. It shows
 * no error details, since the message could name a variable or a path.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <h1 className="text-title">Activity</h1>
      <div className="mt-6 flex flex-col items-start gap-4">
        <Banner tone="danger" title="Something went wrong">
          GitTrack hit an unexpected error. Try again, and check the server log if it keeps happening.
        </Banner>
        <Button
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
