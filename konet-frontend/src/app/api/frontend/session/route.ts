import { NextRequest, NextResponse } from "next/server";
import { usesBearerStorage } from "@/lib/auth/transport";
import { cookies } from "next/headers";
import { sourceMode } from "@/data/access/server";
import { accessExpiresAt, refreshAuth } from "@/lib/auth/live";
import { DataError } from "@/data/access/errors";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const store = await cookies();
  return NextResponse.json(
    {
      mode: sourceMode(),
      ...(usesBearerStorage
        ? { accessToken: store.get("konet_access")?.value }
        : {}),
      expiresAt:
        sourceMode() === "http"
          ? accessExpiresAt(store.get("konet_access")?.value)
          : null,
    },
    { headers },
  );
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    !URL.canParse(origin) ||
    new URL(origin).host !== request.headers.get("host")
  )
    return NextResponse.json(
      { error: { message: "This request is not allowed.", code: "FORBIDDEN" } },
      { status: 403, headers },
    );
  try {
    if (sourceMode() !== "http")
      throw new DataError(
        "Please sign in again.",
        401,
        "LIVE_SESSION_REQUIRED",
      );
    return NextResponse.json(await refreshAuth(), { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof DataError
              ? error.message
              : "Please sign in again.",
          code: error instanceof DataError ? error.code : "SESSION_ERROR",
        },
      },
      { status: error instanceof DataError ? error.status : 500, headers },
    );
  }
}
