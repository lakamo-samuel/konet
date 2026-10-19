"use client";
import { useRouter } from "next/navigation";
import { useDataCommand } from "@/lib/query/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
export function SignOutButton() {
  const signOut = useDataCommand("signOut");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="sign-out-action">
      <Button
        type="button"
        variant="quiet"
        className="signin-button"
        disabled={signOut.isPending}
        onClick={() => setConfirming(true)}
      >
        Sign out
      </Button>
      <ConfirmationDialog
        open={confirming}
        title="Sign out of Konet?"
        description="You’ll need to sign in again to access your requests, messages, and account."
        confirmLabel="Sign out"
        pendingLabel="Signing out…"
        pending={signOut.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          await signOut.mutateAsync({});
          router.replace("/sign-in");
          router.refresh();
        }}
      />
    </div>
  );
}
