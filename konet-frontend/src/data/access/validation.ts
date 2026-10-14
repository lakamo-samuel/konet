import { validateAdminInput } from "@/features/admin/operations";
import { DataError } from "./errors";
import type { CommandName, QueryName } from "./contracts";
type Rule = "string" | "number" | "boolean" | "strings" | "record" | "object";
type Shape = Record<string, Rule>;
const queryShapes: Record<QueryName, Shape> = {
  adminQuery: {operation:"string"},
  ownProviderProfile: {},
  disputes: {},
  dispute: { id: "string" },
  disputeDecisions: { id: "string" },
  commissionPolicy: {},
  verificationMethods: { universityId: "string" },
  studentVerifications: {},
  upload: { id: "string" },
  categories: {},
  universities: {},
  university: { id: "string" },
  providers: {},
  provider: { id: "string" },
  services: { providerId: "string" },
  portfolio: { providerId: "string" },
  reviews: { providerId: "string" },
  jobReview: { jobId: "string" },
  currentUser: {},
  user: { id: "string" },
  jobs: { userId: "string" },
  job: { id: "string" },
  requests: {},
  request: { id: "string" },
  quote: { id: "string" },
  requestQuotes: { requestId: "string" },
  milestones: { jobId: "string" },
  conversations: { userId: "string" },
  conversation: { id: "string" },
  jobConversation: { jobId: "string" },
  messages: { conversationId: "string" },
  notifications: { userId: "string" },
  payment: { jobId: "string" },
  payments: {},
  earnings: {},
  payouts: {},
  payout: { jobId: "string" },
  refunds: { jobId: "string" },
  payoutAccounts: {},
  payoutBanks: {},
  onboarding: {},
};
const commandShapes: Record<CommandName, Shape> = {
  adminCommand: {operation:"string",values:"object"},
  openDispute: { jobId: "string", reason: "string", description: "string" },
  createProviderProfile: {
    professionalTitle: "string",
    bio: "string",
    responseTimeMinutes: "number",
  },
  updateProviderProfile: {
    professionalTitle: "string",
    bio: "string",
    responseTimeMinutes: "number",
  },
  createProviderService: {
    categoryId: "string",
    title: "string",
    description: "string",
    pricingType: "string",
    currency: "string",
  },
  updateProviderService: { id: "string", values: "object" },
  createPortfolioItem: { type: "string", title: "string" },
  updatePortfolioItem: { id: "string", values: "object" },
  deletePortfolioItem: { id: "string" },
  submitProviderEvidence: { dimension: "string", evidenceObjectKey: "string" },
  submitProviderProfile: {},
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
  updateAccountProfile: {},
  requestEmailChange: { email: "string", password: "string" },
  confirmEmailChange: { challengeId: "string", code: "string" },
  changePassword: { currentPassword: "string", newPassword: "string" },
  deactivateAccount: { reason: "string" },
  updateProviderSettings: {},
  setProviderStatus: { status: "string" },
  createRequest: {
    providerId: "string",
    serviceId: "string",
    description: "string",
  },
  createQuote: {
    requestId: "string",
    amountMinor: "number",
    scope: "strings",
    expiresAt: "string",
  },
  acceptQuote: { quoteId: "string" },
  closeRequest: { id: "string", action: "string", reason: "string" },
  closeQuote: { id: "string", action: "string", reason: "string" },
  startJob: { jobId: "string" },
  markJobComplete: { jobId: "string" },
  cancelJob: { jobId: "string", reason: "string" },
  createMilestone: { jobId: "string", title: "string" },
  updateMilestone: { jobId: "string", id: "string", status: "string" },
  sendMessage: { conversationId: "string", content: "string" },
  readConversation: { conversationId: "string" },
  realtimeTicket: {},
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
  createAvatarUpload: { contentType: "string", sizeBytes: "number" },
  completeAvatarUpload: { publicId: "string" },
  completeUpload: { id: "string" },
  deleteUpload: { id: "string" },
  submitVerification: { method: "string", evidenceObjectKey: "string" },
  saveOnboarding: { step: "string", values: "object" },
  publishProvider: {},
  checkout: { jobId: "string" },
  verifyPayment: { jobId: "string" },
  addPayoutAccount: { bankCode: "string", accountNumber: "string" },
  removePayoutAccount: { id: "string" },
  confirmCompletion: { jobId: "string" },
  contact: { email: "string", topic: "string", message: "string" },
};
export function validateOperation(
  kind: "query" | "command",
  name: unknown,
  input: unknown,
) {
  if(name === "adminQuery" || name === "adminCommand") {
    if((kind === "query") !== (name === "adminQuery")) throw new DataError("Invalid staff operation type.");
    validateAdminInput(kind,input);return;
  }
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
        : rule === "object"
          ? value !== null && typeof value === "object" && !Array.isArray(value)
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
    name === "openDispute" &&
    (String(values.reason).trim().length < 3 ||
      String(values.reason).trim().length > 100 ||
      String(values.description).trim().length < 20 ||
      String(values.description).trim().length > 5000)
  )
    throw new DataError(
      "Provide a reason of 3–100 characters and a description of 20–5,000 characters.",
    );
  if (
    ["confirmEmailChange", "confirmVerificationCode"].includes(name) &&
    !/^\d{6}$/.test(String(values.code))
  )
    throw new DataError("Enter the six-digit code from your email.");
  if (
    name === "requestEmailChange" &&
    (String(values.password).length < 1 ||
      String(values.password).length > 1024)
  )
    throw new DataError("Enter your current password.");
  if (
    name === "changePassword" &&
    (!String(values.currentPassword).length ||
      String(values.newPassword).length < 8)
  )
    throw new DataError(
      "Enter your current password and a new password of at least eight characters.",
    );
  if (
    name === "deactivateAccount" &&
    (String(values.reason).trim().length < 3 ||
      String(values.reason).trim().length > 2000)
  )
    throw new DataError("Provide a reason of 3–2,000 characters.");
  if (
    name === "setProviderStatus" &&
    !["active", "paused"].includes(String(values.status))
  )
    throw new DataError("Choose active or paused status.");
  if (name === "updateAccountProfile" || name === "updateProviderSettings") {
    const allowed =
      name === "updateAccountProfile"
        ? ["fullName", "avatarUrl", "universityId", "campusId"]
        : [
            "professionalTitle",
            "bio",
            "coverImageUrl",
            "responseTimeMinutes",
            "availability",
          ];
    if (!allowed.some((key) => values[key] !== undefined))
      throw new DataError("Change at least one profile field.");
    for (const key of allowed)
      if (
        values[key] !== undefined &&
        !(name === "updateAccountProfile" &&
          key === "avatarUrl" &&
          values[key] === null) &&
        (key === "responseTimeMinutes"
          ? !Number.isInteger(values[key]) ||
            Number(values[key]) < 1 ||
            Number(values[key]) > 10080
          : typeof values[key] !== "string")
      )
        throw new DataError(`Please check ${key}.`);
    for (const [key, min, max] of [
      ["fullName", 2, 150],
      ["professionalTitle", 3, 255],
      ["bio", 40, 10000],
    ] as const)
      if (
        values[key] !== undefined &&
        (String(values[key]).trim().length < min ||
          String(values[key]).length > max)
      )
        throw new DataError(`Please check ${key}.`);
    for (const key of ["avatarUrl", "coverImageUrl"])
      if (
        values[key] !== undefined &&
        values[key] !== null &&
        (!URL.canParse(String(values[key])) ||
          new URL(String(values[key])).protocol !== "https:" ||
          String(values[key]).length > 2048)
      )
        throw new DataError("Use a valid HTTPS image URL.");
    if (
      values.availability !== undefined &&
      !["available", "unavailable", "limited"].includes(
        String(values.availability),
      )
    )
      throw new DataError("Choose a valid availability.");
  }
  if (
    name === "sendMessage" &&
    (!String(values.content).trim() || String(values.content).length > 10000)
  )
    throw new DataError("Enter a message of 1–10,000 characters.");
  if (
    name === "addPayoutAccount" &&
    (!/^\d{3,9}$/.test(String(values.bankCode)) ||
      !/^\d{10}$/.test(String(values.accountNumber)))
  )
    throw new DataError("Choose a bank and enter a ten-digit account number.");
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
    name === "createAvatarUpload" &&
    (!["image/jpeg", "image/png", "image/webp"].includes(
      String(values.contentType),
    ) ||
      !Number.isInteger(values.sizeBytes) ||
      Number(values.sizeBytes) < 1 ||
      Number(values.sizeBytes) > 5242880)
  )
    throw new DataError("Choose a JPEG, PNG or WebP image up to 5 MiB.");
  if (
    name === "completeAvatarUpload" &&
    String(values.publicId).length > 255
  )
    throw new DataError("The uploaded image reference is invalid.");
  if (
    typeof values.email === "string" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  )
    throw new DataError("Enter a valid email address.");
  if (
    typeof values.password === "string" &&
    name !== "requestEmailChange" &&
    values.password.length < 8
  )
    throw new DataError("Use a password of at least 8 characters.");
  if (
    name === "closeRequest" &&
    !["withdraw", "decline"].includes(String(values.action))
  )
    throw new DataError("Invalid request action.");
  if (
    name === "closeQuote" &&
    !["decline", "cancel"].includes(String(values.action))
  )
    throw new DataError("Invalid quote action.");
  if (
    ["closeRequest", "closeQuote", "cancelJob"].includes(String(name)) &&
    !String(values.reason).trim()
  )
    throw new DataError("Provide a reason.");
  if (
    name === "createQuote" &&
    (!Number.isInteger(values.amountMinor) ||
      Number(values.amountMinor) < 1 ||
      Number(values.amountMinor) > 2147483647)
  )
    throw new DataError("Enter a valid positive quote amount.");
  if (name === "submitReview" && String(values.body).trim().length < 5)
    throw new DataError(
      "Describe your experience in at least five characters.",
    );
  if (
    name === "submitReview" &&
    (!Number.isInteger(values.rating) ||
      Number(values.rating) < 1 ||
      Number(values.rating) > 5)
  )
    throw new DataError("Choose a rating from 1 to 5.");
  if (
    name === "createRequest" &&
    values.budgetMaxMinor !== undefined &&
    values.budgetMinMinor !== undefined &&
    Number(values.budgetMaxMinor) < Number(values.budgetMinMinor)
  )
    throw new DataError("The maximum budget must be at least the minimum.");
}
