"use client";

import { LockOpen } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { unlock, type UnlockState } from "./actions";

/** DESIGN.md §7.4. The fields stay filled after a wrong login so a typo can be fixed. */
export function UnlockForm() {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlock, { failed: false });
  const [username, setUsername] = useState("");
  const [key, setKey] = useState("");

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <TextInput
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          invalid={state.failed}
        />
        <TextInput
          label="Access key"
          name="key"
          password
          autoComplete="current-password"
          required
          value={key}
          onChange={(event) => setKey(event.target.value)}
          invalid={state.failed}
          error={state.failed ? "That username or key didn't work. Try again." : undefined}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        icon={LockOpen}
        busy={pending}
        busyLabel="Unlocking…"
        className="h-11 w-full sm:h-11"
      >
        Unlock
      </Button>
      <p className="text-caption text-center text-text-muted">Stays unlocked on this device for 30 days.</p>
    </form>
  );
}
