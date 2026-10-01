import { DataError } from "./errors";
import type { CommandName, QueryName } from "./contracts";
type Rule = "string" | "number" | "boolean" | "strings" | "record";
type Shape = Record<string, Rule>;
const queryShapes: Record<QueryName, Shape> = {
  universities: {}, university: { id: "string" }, providers: {}, provider: { id: "string" }, services: { providerId: "string" }, portfolio: { providerId: "string" }, reviews: { providerId: "string" }, currentUser: {}, user: { id: "string" }, jobs: { userId: "string" }, job: { id: "string" }, requests: { providerId: "string" }, request: { id: "string" }, quote: { id: "string" }, conversations: { userId: "string" }, conversation: { id: "string" }, messages: { conversationId: "string" }, notifications: { userId: "string" }, transaction: { jobId: "string" }, onboarding: {},
};
const commandShapes: Record<CommandName, Shape> = {
  signIn: { email: "string", password: "string" }, signUp: { name: "string", email: "string", password: "string" }, forgotPassword: { email: "string" }, signOut: {}, saveProfile: { name: "string", email: "string", campus: "string" }, saveProvider: { professionalTitle: "string", responseTime: "string", available: "boolean" }, saveService: { providerId: "string", name: "string", description: "string", startingPrice: "number", pricingUnit: "string" }, createRequest: { providerId: "string", serviceId: "string", date: "string", time: "string", location: "string", budgetMin: "number", budgetMax: "number", details: "string" }, createQuote: { requestId: "string", amount: "number", scope: "strings", note: "string" }, acceptQuote: { quoteId: "string" }, sendMessage: { conversationId: "string", body: "string" }, readNotification: { id: "string" }, submitReview: { jobId: "string", rating: "number", body: "string" }, submitVerification: { universityId: "string", studentNumber: "string", email: "string" }, saveOnboarding: { step: "string", values: "record" }, publishProvider: {}, checkout: { jobId: "string" }, confirmCompletion: { jobId: "string" }, contact: { email: "string", topic: "string", message: "string" },
};
export function validateOperation(kind: "query" | "command", name: unknown, input: unknown) {
  const shapes = kind === "query" ? queryShapes : commandShapes;
  if (typeof name !== "string" || !Object.hasOwn(shapes, name)) throw new DataError("Unknown operation.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DataError("Invalid request.");
  const values = input as Record<string, unknown>;
  for (const [key, rule] of Object.entries(shapes[name as keyof typeof shapes])) {
    const value = values[key];
    const valid = rule === "strings" ? Array.isArray(value) && value.length > 0 && value.every(item => typeof item === "string") : rule === "record" ? value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(item => typeof item === "string") : typeof value === rule;
    if (!valid || (rule === "number" && (!Number.isFinite(value) || (value as number) < 0))) throw new DataError(`Please check ${key}.`);
  }
  if (typeof values.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw new DataError("Enter a valid email address.");
  if (typeof values.password === "string" && values.password.length < 8) throw new DataError("Use a password of at least 8 characters.");
  if (name === "submitReview" && (!Number.isInteger(values.rating) || Number(values.rating) < 1 || Number(values.rating) > 5)) throw new DataError("Choose a rating from 1 to 5.");
  if (name === "createRequest" && Number(values.budgetMax) < Number(values.budgetMin)) throw new DataError("The maximum budget must be at least the minimum.");
}
