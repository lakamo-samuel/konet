"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
export function ResetPasswordForm() {
  const reset = useDataCommand("resetPassword");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  if (done)
    return (
      <div role="status">
        <h2>Password updated</h2>
        <p>Sign in with your new password.</p>
        <Button href="/sign-in">Sign in</Button>
      </div>
    );
  return (
    <form
      className="auth-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const password = String(fields.get("password") ?? "");
        if (password !== fields.get("confirmPassword")) {
          setError("Passwords do not match.");
          return;
        }
        const token = new URLSearchParams(window.location.hash.slice(1)).get(
          "token",
        );
        if (!token) {
          setError("This recovery link is incomplete. Request a new link.");
          return;
        }
        setError("");
        try {
          await reset.mutateAsync({ token, password });
          window.history.replaceState(null, "", window.location.pathname);
          setDone(true);
        } catch {
          /* shown below */
        }
      }}
    >
      <label>
        New password
        <input
          name="password"
          type="password"
          minLength={8}
          maxLength={1024}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          minLength={8}
          maxLength={1024}
          autoComplete="new-password"
          required
        />
      </label>
      {(error || reset.isError) && (
        <p role="alert" className="field-error">
          {error || errorMessage(reset.error)}
        </p>
      )}
      <Button type="submit" disabled={reset.isPending}>
        {reset.isPending ? "Updating…" : "Reset password"}
      </Button>
      <Button href="/forgot-password" variant="secondary">
        Request a new link
      </Button>
    </form>
  );
}
