"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshData } from "@/app/actions";
import { Button } from "@/components/ui/Button";

/** Refetches the data on the server and re-renders. The current data stays on screen meanwhile. */
export function useRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () =>
    startTransition(async () => {
      await refreshData();
      router.refresh();
    });
  return { pending, refresh };
}

/** The 44px icon button on mobile and the labelled button on desktop. */
export function RefreshButton() {
  const { pending, refresh } = useRefresh();
  return (
    <>
      <span className="sm:hidden">
        <Button
          iconOnly
          icon={RefreshCw}
          aria-label={pending ? "Refreshing…" : "Refresh"}
          busy={pending}
          onClick={refresh}
        />
      </span>
      <span className="hidden sm:block">
        <Button icon={RefreshCw} busy={pending} busyLabel="Refreshing…" onClick={refresh}>
          Refresh
        </Button>
      </span>
    </>
  );
}
