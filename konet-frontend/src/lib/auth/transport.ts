// Frontend environment controls browser transport, independently of API deployment.
export const usesBearerStorage = process.env.NODE_ENV === "development";
export const accessTokenKey = "konet.accessToken";
export function readAccessToken(): string | null {
  if (!usesBearerStorage || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(accessTokenKey);
  } catch {
    return null;
  }
}
export function saveAccessToken(token?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (usesBearerStorage && token)
      window.localStorage.setItem(accessTokenKey, token);
    else window.localStorage.removeItem(accessTokenKey);
  } catch {
    /* Storage can be disabled; the same-origin session remains usable. */
  }
}
