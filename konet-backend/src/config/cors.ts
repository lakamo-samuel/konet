export function resolveCorsOrigins(
  frontendUrl: string,
  configured?: string,
): string[] {
  return [
    ...new Set(
      (configured || frontendUrl).split(",").map((value) => {
        const input = value.trim();
        const url = new URL(input);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          url.pathname !== "/"
        )
          throw new Error(
            "CORS_ORIGINS must contain comma-separated HTTP(S) origins without paths or credentials.",
          );
        return url.origin;
      }),
    ),
  ];
}
