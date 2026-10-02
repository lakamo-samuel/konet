import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverQuery, serverCommand, dataContext } from "@/data/access/server";
import { validateOperation } from "@/data/access/validation";
import { DataError } from "@/data/access/errors";
import type {
  CommandInput,
  CommandName,
  QueryInput,
  QueryName,
} from "@/data/access/contracts";
import { usesBearerStorage } from "@/lib/auth/transport";

export const dynamic = "force-dynamic";
const publicQueries = new Set([
  "universities",
  "university",
  "providers",
  "provider",
  "services",
  "portfolio",
  "reviews",
]);
const publicCommands = new Set([
  "signIn",
  "signUp",
  "forgotPassword",
  "resetPassword",
  "signOut",
  "contact",
]);
const failure = (error: unknown) =>
  error instanceof DataError
    ? NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status },
      )
    : NextResponse.json(
        {
          error: {
            message: "Something went wrong. Please try again.",
            code: "INTERNAL_ERROR",
          },
        },
        { status: 500 },
      );

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name") as QueryName;
    const input = JSON.parse(request.nextUrl.searchParams.get("input") ?? "{}");
    validateOperation("query", name, input);
    if (!publicQueries.has(name) && !(await dataContext()).accessToken)
      throw new DataError("Please sign in to continue.", 401);
    return NextResponse.json(
      {
        data: await serverQuery(name, input as QueryInput<typeof name>, false),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(
      error instanceof SyntaxError ? new DataError("Invalid request.") : error,
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (
      !origin ||
      !URL.canParse(origin) ||
      new URL(origin).host !== request.headers.get("host")
    )
      throw new DataError("This request is not allowed.", 403);
    const raw = await request.text();
    if (raw.length > 65536)
      throw new DataError("The request is too large.", 413);
    const { name, input } = JSON.parse(raw) as {
      name: CommandName;
      input: CommandInput<CommandName>;
    };
    validateOperation("command", name, input);
    const store = await cookies();
    if (!publicCommands.has(name) && !(await dataContext()).accessToken)
      throw new DataError("Please sign in to continue.", 401);
    const data = await serverCommand(name, input);
    const authentication =
      usesBearerStorage && (name === "signIn" || name === "signUp")
        ? { accessToken: store.get("konet_access")?.value }
        : undefined;
    return NextResponse.json(
      { data, ...(authentication ? { authentication } : {}) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(
      error instanceof SyntaxError ? new DataError("Invalid request.") : error,
    );
  }
}
