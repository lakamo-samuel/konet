"use client";
import { useEffect } from "react";
import { refreshSession } from "@/lib/auth/refresh-client";
import { sessionEndedEvent } from "@/lib/auth/end-session";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
export function SessionKeeper() {
  const cache = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    const ended = () => {
      cache.clear();
      if (!window.location.pathname.startsWith("/session/")) router.refresh();
    };
    window.addEventListener(sessionEndedEvent, ended);
    const renew = () => {
      if (document.visibilityState === "visible")
        void refreshSession(false).catch(() => undefined);
    };
    renew();
    const timer = setInterval(renew, 60000);
    document.addEventListener("visibilitychange", renew);
    window.addEventListener("focus", renew);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", renew);
      window.removeEventListener("focus", renew);
      window.removeEventListener(sessionEndedEvent, ended);
    };
  }, [cache, router]);
  return null;
}
