"use client";
import { useEffect, useRef, useState } from "react";
import { refreshSession } from "@/lib/auth/refresh-client";
import { Button } from "@/components/ui/button";
import { safeReturnPath } from "@/lib/auth/navigation";
import { endBrowserSession } from "@/lib/auth/end-session";
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
      .catch(async () => {
        try {
          await endBrowserSession();
          const next = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
          window.location.replace(`/sign-in?next=${encodeURIComponent(next.startsWith("/session/") ? "/discover" : next)}`);
        } catch {
          setError("We couldn’t connect. You can return to the home page or try signing in again.");
        }
      });
  }, []);
  return (
    <div className="auth-panel">
      <h2>{error ? "Sign in to continue" : "Restoring your session…"}</h2>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Button href="/sign-in">Sign in</Button>
          <Button href="/" variant="secondary">Back to home</Button>
        </>
      ) : (
        <p>Please wait a moment.</p>
      )}
    </div>
  );
}
