"use client";
import { useEffect } from "react";
import { refreshSession } from "@/lib/auth/refresh-client";
export function SessionKeeper() {
  useEffect(() => {
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
    };
  }, []);
  return null;
}
