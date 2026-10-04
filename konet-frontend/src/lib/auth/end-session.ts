"use client";

import { saveAccessToken } from "./transport";

export const sessionEndedEvent = "konet:session-ended";
export function notifySessionEnded() {
  saveAccessToken();
  window.dispatchEvent(new Event(sessionEndedEvent));
}
export async function endBrowserSession() {
  const response = await fetch("/api/frontend/session", {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("We couldn’t sign you out. Please try again.");
  notifySessionEnded();
}
