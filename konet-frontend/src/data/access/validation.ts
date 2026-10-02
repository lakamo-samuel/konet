import { DataError } from "./errors";
import type { CommandName, QueryName } from "./contracts";
type Rule = "string" | "number" | "boolean" | "strings" | "record";
type Shape = Record<string, Rule>;
const queryShapes: Record<QueryName, Shape> = {
  verificationMethods: { universityId: "string" },
  studentVerifications: {},
  upload: { id: "string" },
  universities: {},
  university: { id: "string" },
  providers: {},
  provider: { id: "string" },
  services: { providerId: "string" },
  portfolio: { providerId: "string" },
  reviews: { providerId: "string" },
  currentUser: {},
  user: { id: "string" },
  jobs: { userId: "string" },
  job: { id: "string" },
  requests: { providerId: "string" },
  request: { id: "string" },
  quote: { id: "string" },
  conversations: { userId: "string" },
  conversation: { id: "string" },
  messages: { conversationId: "string" },
  notifications: { userId: "string" },
  transaction: { jobId: "string" },
  onboarding: {},
};
const commandShapes: Record<CommandName, Shape> = {
  signIn: { email: "string", password: "string" },
  signUp: {
    name: "string",
    email: "string",
    password: "string",
    universityId: "string",
    campusId: "string",
  },
  forgotPassword: { email: "string" },
  resetPassword: { token: "string", password: "string" },
  signOut: {},
  saveProfile: { name: "string", email: "string", campus: "string" },
  saveProvider: {
    professionalTitle: "string",
    responseTime: "string",
    available: "boolean",
  },
  saveService: {
    providerId: "string",
    name: "string",
    description: "string",
    startingPrice: "number",
    pricingUnit: "string",
  },
  createRequest: {
    providerId: "string",
    serviceId: "string",
    date: "string",
    time: "string",
    location: "string",
    budgetMin: "number",
    budgetMax: "number",
    details: "string",
  },
  createQuote: {
    requestId: "string",
    amount: "number",
    scope: "strings",
    note: "string",
  },
  acceptQuote: { quoteId: "string" },
  sendMessage: { conversationId: "string", body: "string" },
  readNotification: { id: "string" },
  submitReview: { jobId: "string", rating: "number", body: "string" },
  requestVerificationCode: { email: "string" },
  confirmVerificationCode: { challengeId: "string", code: "string" },
  createUpload: {
    purpose: "string",
    fileName: "string",
    contentType: "string",
    sizeBytes: "number",
  },
  completeUpload: { id: "string" },
  deleteUpload: { id: "string" },
  submitVerification: { method: "string", evidenceObjectKey: "string" },
  saveOnboarding: { step: "string", values: "record" },
  publishProvider: {},
  checkout: { jobId: "string" },
  confirmCompletion: { jobId: "string" },
  contact: { email: "string", topic: "string", message: "string" },
};
export function validateOperation(
  kind: "query" | "command",
  name: unknown,
  input: unknown,
) {
  const shapes = kind === "query" ? queryShapes : commandShapes;
  if (typeof name !== "string" || !Object.hasOwn(shapes, name))
    throw new DataError("Unknown operation.");
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new DataError("Invalid request.");
  const values = input as Record<string, unknown>;
  for (const [key, rule] of Object.entries(
    shapes[name as keyof typeof shapes],
  )) {
    const value = values[key];
    const valid =
      rule === "strings"
        ? Array.isArray(value) &&
          value.length > 0 &&
          value.every((item) => typeof item === "string")
        : rule === "record"
          ? value !== null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            Object.values(value).every((item) => typeof item === "string")
          : typeof value === rule;
    if (
      !valid ||
      (rule === "number" && (!Number.isFinite(value) || (value as number) < 0))
    )
      throw new DataError(`Please check ${key}.`);
  }
  if (
    name === "confirmVerificationCode" &&
    !/^\d{6}$/.test(String(values.code))
  )
    throw new DataError("Enter the six-digit code from your email.");
  if (
    name === "submitVerification" &&
    (!["student_id", "manual_document"].includes(String(values.method)) ||
      !String(values.evidenceObjectKey).trim() ||
      (values.method === "student_id" &&
        (typeof values.studentNumber !== "string" ||
          values.studentNumber.trim().length < 3)))
  )
    throw new DataError(
      "Choose a document method and provide the required student details.",
    );
  if (
    name === "createUpload" &&
    (!["student_evidence", "provider_evidence"].includes(
      String(values.purpose),
    ) ||
      !["image/jpeg", "image/png", "application/pdf"].includes(
        String(values.contentType),
      ) ||
      !Number.isInteger(values.sizeBytes) ||
      Number(values.sizeBytes) < 1 ||
      Number(values.sizeBytes) > 10485760)
  )
    throw new DataError("Choose a JPEG, PNG or PDF file up to 10 MiB.");
  if (
    typeof values.email === "string" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  )
    throw new DataError("Enter a valid email address.");
  if (typeof values.password === "string" && values.password.length < 8)
    throw new DataError("Use a password of at least 8 characters.");
  if (
    name === "submitReview" &&
    (!Number.isInteger(values.rating) ||
      Number(values.rating) < 1 ||
      Number(values.rating) > 5)
  )
    throw new DataError("Choose a rating from 1 to 5.");
  if (
    name === "createRequest" &&
    Number(values.budgetMax) < Number(values.budgetMin)
  )
    throw new DataError("The maximum budget must be at least the minimum.");
}
