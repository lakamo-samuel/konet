export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/discover",
): string {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(value)
    ? value
    : fallback;
}
