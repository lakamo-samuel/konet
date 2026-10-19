"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
export function ReasonAction({
  label,
  pending,
  action,
}: {
  label: string;
  pending: boolean;
  action: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) setConfirming(true);
      }}
    >
      <label className="field">
        Reason for {label.toLowerCase()}
        <textarea
          value={reason}
          required
          minLength={3}
          maxLength={10000}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <Button
        type="submit"
        variant="secondary"
        disabled={pending || !reason.trim()}
      >
        {pending ? "Working…" : label}
      </Button>
      <ConfirmationDialog
        open={confirming}
        title={`Confirm: ${label.toLowerCase()}?`}
        description="This will update the current request, quote, or job and may not be reversible."
        confirmLabel={label}
        pendingLabel="Working…"
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          await action(reason.trim());
          setReason("");
        }}
      />
    </form>
  );
}
