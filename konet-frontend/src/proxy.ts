import { NextRequest, NextResponse } from "next/server";
const protectedRoutes = [
  "/discover",
  "/search",
  "/providers",
  "/requests",
  "/quotes",
  "/checkout",
  "/payment-result",
  "/jobs",
  "/disputes",
  "/messages",
  "/notifications",
  "/profile",
  "/settings",
  "/verification",
  "/verify-student",
  "/provider",
];
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = request.cookies.get("konet_access")?.value;
  if (
    protectedRoutes.some(
      (route) => path === route || path.startsWith(`${route}/`),
    ) &&
    !session
  ) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-konet-pathname", path + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: [
    "/discover/:path*",
    "/search/:path*",
    "/providers/:path*",
    "/requests/:path*",
    "/quotes/:path*",
    "/checkout/:path*",
    "/payment-result",
    "/jobs/:path*",
    "/disputes/:path*",
    "/messages/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/verification/:path*",
    "/verify-student",
    "/provider/:path*",
  ],
};
