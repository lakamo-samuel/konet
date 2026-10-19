export function staffVerificationDestination(requestedPath: string | null) {
  if (requestedPath === "/admin") return requestedPath;
  if (
    requestedPath?.startsWith("/admin/") &&
    requestedPath !== "/admin/security" &&
    !requestedPath.includes("\\") &&
    !requestedPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return requestedPath;
  }
  return "/admin";
}
