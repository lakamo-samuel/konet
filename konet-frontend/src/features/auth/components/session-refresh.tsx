"use client";
import { useEffect, useRef, useState } from "react";
import { refreshSession } from "@/lib/auth/refresh-client";
import { Button } from "@/components/ui/button";
import { safeReturnPath } from "@/lib/auth/navigation";
export function SessionRefresh() {
  const [error, setError] = useState("");
  const begun = useRef(false);
  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    void refreshSession()
      .then(() => {
        const next = safeReturnPath(
          new URLSearchParams(window.location.search).get("next"),
        );
        window.location.replace(
          next.startsWith("/session/") ? "/discover" : next,
        );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Please sign in again."),
      );
  }, []);
  return (
    <div className="auth-panel">
      <h2>{error ? "Sign in to continue" : "Restoring your session…"}</h2>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Button href="/sign-in">Sign in</Button>
        </>
      ) : (
        <p>Please wait a moment.</p>
      )}
    </div>
  );
}
