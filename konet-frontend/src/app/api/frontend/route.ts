import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverQuery, serverCommand, sourceMode } from "@/data/access/server";
import { validateOperation } from "@/data/access/validation";
import { DataError } from "@/data/access/errors";
import type { CommandInput, CommandName, QueryInput, QueryName } from "@/data/access/contracts";
import type { User } from "@/types/domain";

export const dynamic = "force-dynamic";
const publicQueries = new Set(["universities", "university", "providers", "provider", "services", "portfolio", "reviews"]);
const publicCommands = new Set(["signIn", "signUp", "forgotPassword", "contact"]);
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 604800 };
const failure = (error: unknown) => error instanceof DataError ? NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status }) : NextResponse.json({ error: { message: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" } }, { status: 500 });

async function checkReadAccess(name: QueryName, input: Record<string, unknown>, userId: string, providerId?: string) {
  const forbidden = () => { throw new DataError("You cannot access this item.", 403); };
  if (["jobs", "conversations", "notifications"].includes(name) && input.userId !== userId) forbidden();
  if (name === "user" && input.id !== userId) forbidden();
  if (name === "requests" && input.providerId !== providerId) forbidden();
  if (name === "messages" || name === "conversation") {
    const conversation = await serverQuery("conversation", { id: String(name === "messages" ? input.conversationId : input.id) });
    if (!conversation?.participantIds.includes(userId)) forbidden();
  }
  if (name === "job" || name === "transaction") {
    const job = await serverQuery("job", { id: String(name === "job" ? input.id : input.jobId) });
    if (!job || (job.clientId !== userId && job.providerId !== providerId)) forbidden();
  }
  if (name === "request" || name === "quote") {
    const quote = name === "quote" ? await serverQuery("quote", { id: String(input.id) }) : null;
    const requestId = name === "request" ? String(input.id) : quote?.requestId;
    const request = requestId ? await serverQuery("request", { id: requestId }) : null;
    if (!request || (request.clientId !== userId && request.providerId !== providerId)) forbidden();
  }
}

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name") as QueryName;
    const input = JSON.parse(request.nextUrl.searchParams.get("input") ?? "{}");
    validateOperation("query", name, input);
    const store = await cookies();
    const userId = store.get("konet_session")?.value;
    if (!publicQueries.has(name) && !userId) throw new DataError("Please sign in to continue.", 401);
    if (!publicQueries.has(name) && userId) await checkReadAccess(name, input as Record<string, unknown>, userId, store.get("konet_provider")?.value);
    return NextResponse.json({ data: await serverQuery(name, input as QueryInput<typeof name>) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error instanceof SyntaxError ? new DataError("Invalid request.") : error); }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")) throw new DataError("This request is not allowed.", 403);
    const raw = await request.text();
    if (raw.length > 65536) throw new DataError("The request is too large.", 413);
    const { name, input } = JSON.parse(raw) as { name: CommandName; input: CommandInput<CommandName> };
    validateOperation("command", name, input);
    const store = await cookies();
    if (!publicCommands.has(name) && !store.has("konet_session")) throw new DataError("Please sign in to continue.", 401);
    const data = await serverCommand(name, input);
    // Fixture session state stays at the adapter boundary. Live auth is enabled only with its HTTP contract.
    if (sourceMode() === "mock") {
      if (name === "signIn" || name === "signUp") {
        const user = data as User;
        store.set("konet_session", user.id, cookieOptions);
        store.set("konet_student_verified", String(user.studentVerification === "verified"), cookieOptions);
        if (user.providerProfileId) store.set("konet_provider", user.providerProfileId, cookieOptions); else store.delete("konet_provider");
      }
      if (name === "submitVerification") store.set("konet_student_verified", String((data as { status: string }).status === "verified"), cookieOptions);
      if (name === "publishProvider") store.set("konet_provider", (data as { providerId: string }).providerId, cookieOptions);
      if (name === "signOut") for (const key of ["konet_session", "konet_student_verified", "konet_provider", "konet_access"]) store.delete(key);
    }
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error instanceof SyntaxError ? new DataError("Invalid request.") : error); }
}
