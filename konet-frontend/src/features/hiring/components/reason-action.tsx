"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
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
  const [error, setError] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (pending) return;
        try {
          await action(reason.trim());
          setReason("");
        } catch (cause) {
          setError(errorMessage(cause));
        }
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
      {error && <p role="alert">{error}</p>}
      <Button
        type="submit"
        variant="secondary"
        disabled={pending || !reason.trim()}
      >
        {pending ? "Saving…" : label}
      </Button>
    </form>
  );
}
