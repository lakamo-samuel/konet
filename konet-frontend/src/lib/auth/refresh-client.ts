"use client";
let running: Promise<void> | undefined;
async function state() {
  const response = await fetch("/api/frontend/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok)
    throw new Error("Your session could not be checked. Please try again.");
  return response.json() as Promise<{
    mode: "mock" | "http";
    expiresAt: number | null;
  }>;
}
export function refreshSession(force = true): Promise<void> {
  if (running) return running;
  const run = async () => {
    const observed = await state();
    if (observed.mode !== "http") {
      if (force) throw new Error("Please sign in again.");
      return;
    }
    if (observed.expiresAt === null && !force) return;
    const refresh = async () => {
      const latest = await state();
      if (
        latest.expiresAt &&
        latest.expiresAt !== observed.expiresAt &&
        latest.expiresAt > Date.now()
      )
        return;
      if (!force && latest.expiresAt && latest.expiresAt > Date.now() + 60000)
        return;
      const response = await fetch("/api/frontend/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session has ended. Please sign in again."
            : "Your session could not be renewed. Please try again.",
        );
    };
    // Web Locks serialize rotating refresh credentials across tabs on the same origin.
    if (navigator.locks)
      await navigator.locks.request("konet-session-refresh", refresh);
    else await refresh();
  };
  running = run().finally(() => {
    running = undefined;
  });
  return running;
}
