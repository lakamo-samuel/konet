import { adminQueries, adminCommands, operationPath, type AdminResponse } from "@/features/admin/operations";
import type {
  AvatarUploadTicket,
  EmailChangeChallenge,
} from "@/types/account-settings";
import type { Dispute, DisputeDecision } from "@/types/disputes";
import { socketConfiguration } from "@/lib/realtime/config";
import type { RealtimeTicket, ReadResult } from "@/types/messaging";
import type { Conversation, Message } from "@/types/domain";
import type {
  CommissionPolicy,
  Payment,
  Checkout,
  Earnings,
  Payout,
  Refund,
  PayoutAccount,
  PayoutBank,
} from "@/types/payments";
import type {
  HiringRequest,
  HiringQuote,
  HiringJob,
  Milestone,
} from "@/types/hiring";
import type {
  ProviderOnboarding,
  OwnProviderProfile,
  OwnProviderService,
  OwnPortfolioItem,
  ProviderVerification,
  Category,
  ProviderCoverUploadTicket,
} from "@/types/provider-onboarding";
import type {
  VerificationMethods,
  StudentVerification,
  EmailChallenge,
  PrivateUpload,
  UploadTicket,
} from "@/types/verification";
import type {
  CommandContract,
  CommandName,
  QueryContract,
  QueryName,
} from "./contracts";
import type {
  Notification,
  PortfolioItem,
  Review,
  ProviderProfile,
  Service,
  University,
} from "@/types/domain";

export type Endpoint<I, O> = {
  method: "GET" | "POST" | "PATCH" | "DELETE" | ((input:I)=>"GET" | "POST" | "PATCH" | "DELETE");
  path: (input: I) => string;
  params?: (input: I) => unknown;
  body?: (input: I) => unknown;
  decode: (data: unknown) => O;
  notFoundCode?: string;
};
type ApiService = {
  id: string;
  providerId: string;
  title: string;
  description: string;
  priceMinor: number | null;
  pricingType: string;
  status: string;
};
type ApiProvider = {
  id: string;
  userId: string;
  fullName: string;
  universityId: string;
  campusName?: string;
  campusId?: string;
  professionalTitle: string;
  bio: string;
  availability: string;
  responseTimeMinutes: number;
  coverImageUrl: string | null;
  avatarUrl: string | null;
  reputation?: { rating: number; reviewCount: number };
  verification?: { dimension: string; status: string }[];
  services?: ApiService[];
};
const service = (data: ApiService): Service => ({
  id: data.id,
  providerId: data.providerId,
  name: data.title,
  description: data.description,
  startingPrice: (data.priceMinor ?? 0) / 100,
  pricingUnit: data.pricingType,
  active: data.status === "active",
});
const provider = (data: ApiProvider): ProviderProfile => ({
  id: data.id,
  userId: data.userId,
  fullName: data.fullName,
  universityId: data.universityId,
  campus: data.campusName ?? "",
  campusId: data.campusId,
  priceKnown: !!data.services?.some((s) => s.priceMinor !== null),
  reputationKnown: !!data.reputation,
  completedJobsKnown: false,
  professionalTitle: data.professionalTitle,
  category: data.services?.[0]?.title ?? data.professionalTitle,
  bio: data.bio,
  startingPrice:
    (data.services?.find((s) => s.priceMinor !== null)?.priceMinor ?? 0) / 100,
  available: data.availability === "available",
  responseTime: `Usually responds within ${data.responseTimeMinutes} minutes`,
  verification: {
    identity: data.verification?.some(
      (item) => item.dimension === "identity" && item.status === "verified",
    )
      ? "verified"
      : "unverified",
    work: data.verification?.some(
      (item) => item.dimension === "work" && item.status === "verified",
    )
      ? "verified"
      : "unverified",
  },
  reputation: {
    rating: data.reputation?.rating ?? 0,
    reviewCount: data.reputation?.reviewCount ?? 0,
    completedJobs: 0,
    completionRate: 0,
    repeatClients: 0,
    unresolvedDisputes: 0,
  },
  coverImage: data.coverImageUrl ?? "",
  avatar: data.avatarUrl ?? "",
});
const university = (
  data: Omit<University, "campuses"> & {
    campuses: { id: string; name: string }[];
  },
): University => ({
  ...data,
  campuses: data.campuses.map((item) => item.name),
  campusOptions: data.campuses.map((item) => ({
    id: item.id,
    name: item.name,
  })),
});

type ApiReview = {
  id: string;
  jobId: string;
  providerId: string;
  clientId: string;
  rating: number;
  comment: string;
  createdAt: string;
};
const review = (r: ApiReview): Review => ({
  id: r.id,
  jobId: r.jobId,
  providerId: r.providerId,
  authorId: r.clientId,
  rating: r.rating,
  body: r.comment,
  service: "Completed service",
  verifiedJob: true,
  createdAt: r.createdAt,
});
type ApiNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
};
const notification = (n: ApiNotification): Notification => {
  const type = ([
    "request",
    "quote",
    "payment",
    "job",
    "review",
    "verification",
    "dispute",
  ].find((t) => n.type.startsWith(t)) ?? "job") as Notification["type"];
  const routes: Record<string, string> = {
    job: "/jobs/",
    request: "/requests/",
    quote: "/quotes/",
    conversation: "/messages/",
    dispute: "/disputes/",
  };
  const href =
    n.resourceType && n.resourceId && routes[n.resourceType]
      ? routes[n.resourceType] + encodeURIComponent(n.resourceId)
      : n.resourceType?.includes("verification")
        ? "/verification"
        : "/notifications";
  return {
    id: n.id,
    userId: n.userId,
    type,
    title: n.title,
    body: n.body,
    read: !!n.readAt,
    href,
    createdAt: n.createdAt,
  };
};
// This is the integration registry. Add a path, request mapper and response decoder here
// once an endpoint contract is agreed. A missing endpoint fails explicitly; it never falls back to fixtures.
export const queryEndpoints: {
  [K in QueryName]: Endpoint<QueryContract[K][0], QueryContract[K][1]> | null;
} = {
  adminQuery: {method:"GET",path:i=>operationPath(adminQueries[i.operation].path,i.params),params:i=>i.filters,decode:d=>d as AdminResponse},
  ownProviderProfile: {
    method: "GET",
    path: () => "/me/provider-profile",
    decode: (d) => d as OwnProviderProfile,
  },
  disputes: {
    method: "GET",
    path: () => "/disputes",
    params: (i) => ({ limit: 20, offset: i.offset, status: i.status }),
    decode: (d) => d as Dispute[],
  },
  dispute: {
    method: "GET",
    path: (i) => `/disputes/${encodeURIComponent(i.id)}`,
    decode: (d) => d as Dispute,
  },
  disputeDecisions: {
    method: "GET",
    path: (i) => `/disputes/${encodeURIComponent(i.id)}/decisions`,
    decode: (d) => d as DisputeDecision[],
  },
  commissionPolicy: {
    method: "GET",
    path: () => "/payments/policy",
    decode: (d) => d as CommissionPolicy,
  },
  verificationMethods: {
    method: "GET",
    path: (i) =>
      `/universities/${encodeURIComponent(i.universityId)}/verification-methods`,
    decode: (data) => data as VerificationMethods,
  },
  studentVerifications: {
    method: "GET",
    path: () => "/me/student-verification",
    decode: (data) => data as StudentVerification[],
  },
  upload: {
    method: "GET",
    path: (i) => `/uploads/${encodeURIComponent(i.id)}`,
    decode: (data) => data as PrivateUpload,
  },
  categories: {
    method: "GET",
    path: () => "/categories",
    decode: (data) => data as Category[],
  },
  universities: {
    method: "GET",
    path: () => "/universities",
    decode: (data) =>
      (data as Parameters<typeof university>[0][]).map(university),
  },
  university: {
    method: "GET",
    path: (input) => `/universities/${encodeURIComponent(input.id)}`,
    decode: (data) =>
      data ? university(data as Parameters<typeof university>[0]) : null,
  },
  providers: {
    method: "GET",
    path: () => "/providers",
    params: (input) => ({
      query: input.query,
      universityId: input.universityId,
      maxPriceMinor:
        input.maxPrice === undefined
          ? undefined
          : Math.round(input.maxPrice * 100),
      availability: input.available ? "available" : undefined,
    }),
    decode: (data) => (data as ApiProvider[]).map(provider),
  },
  provider: {
    method: "GET",
    path: (input) => `/providers/${encodeURIComponent(input.id)}`,
    decode: (data) => (data ? provider(data as ApiProvider) : null),
  },
  services: {
    method: "GET",
    path: (input) => `/providers/${encodeURIComponent(input.providerId)}`,
    decode: (data) => ((data as ApiProvider).services ?? []).map(service),
  },
  portfolio: {
    method: "GET",
    path: (i) => `/providers/${encodeURIComponent(i.providerId)}/portfolio`,
    decode: (data) =>
      (
        data as {
          id: string;
          providerId: string;
          title: string;
          type: string;
          assetUrl: string | null;
          description: string | null;
          externalUrl: string | null;
        }[]
      ).map(
        (p) =>
          ({
            id: p.id,
            providerId: p.providerId,
            title: p.title,
            category: p.type,
            image: p.assetUrl ?? "",
            description: p.description ?? "",
            externalUrl: p.externalUrl ?? undefined,
            alt: p.title,
          }) satisfies PortfolioItem,
      ),
  },
  reviews: {
    method: "GET",
    path: (i) => `/providers/${encodeURIComponent(i.providerId)}/reviews`,
    decode: (d) => (d as ApiReview[]).map(review),
  },
  jobReview: {
    method: "GET",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/review`,
    notFoundCode: "REVIEW_NOT_FOUND",
    decode: (d) => (d === null ? null : review(d as ApiReview)),
  },
  notifications: {
    method: "GET",
    path: () => "/notifications",
    params: (i) => ({ limit: 100, status: i.status }),
    decode: (data) => (data as ApiNotification[]).map(notification),
  },
  currentUser: null,
  user: null,
  jobs: {
    method: "GET",
    path: () => "/jobs",
    params: (i) => ({ limit: i.limit ?? 20, offset: i.offset ?? 0 }),
    decode: (d) => d as HiringJob[],
  },
  job: {
    method: "GET",
    path: (i) => `/jobs/${encodeURIComponent(i.id)}`,
    decode: (d) => d as HiringJob,
  },
  requests: {
    method: "GET",
    path: () => "/requests",
    params: (i) => ({ limit: i.limit ?? 20, offset: i.offset ?? 0 }),
    decode: (d) => d as HiringRequest[],
  },
  request: {
    method: "GET",
    path: (i) => `/requests/${encodeURIComponent(i.id)}`,
    decode: (d) => d as HiringRequest,
  },
  quote: {
    method: "GET",
    path: (i) => `/quotes/${encodeURIComponent(i.id)}`,
    decode: (d) => d as HiringQuote,
  },
  requestQuotes: {
    method: "GET",
    path: (i) => `/requests/${encodeURIComponent(i.requestId)}/quotes`,
    params: (i) => ({ limit: 20, offset: i.offset ?? 0 }),
    decode: (d) => d as HiringQuote[],
  },
  milestones: {
    method: "GET",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/milestones`,
    decode: (d) => d as Milestone[],
  },
  conversations: {
    method: "GET",
    path: () => "/conversations",
    params: (i) => ({ offset: i.offset ?? 0, limit: 20 }),
    decode: (d) => d as Conversation[],
  },
  conversation: {
    method: "GET",
    path: (i) => `/conversations/${encodeURIComponent(i.id)}`,
    decode: (d) => d as Conversation,
  },
  messages: {
    method: "GET",
    path: (i) =>
      `/conversations/${encodeURIComponent(i.conversationId)}/messages`,
    params: (i) => ({ offset: i.offset ?? 0, limit: i.limit ?? 100 }),
    decode: (d) => d as Message[],
  },
  jobConversation: {
    method: "GET",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/conversation`,
    decode: (d) => d as Conversation,
  },
  payment: {
    method: "GET",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/payment`,
    decode: (d) => d as Payment,
  },
  payments: {
    method: "GET",
    path: () => "/me/payments",
    params: (i) => ({
      offset: i.offset ?? 0,
      limit: i.limit ?? 20,
      status: i.status,
    }),
    decode: (d) => d as Payment[],
  },
  earnings: {
    method: "GET",
    path: () => "/me/earnings",
    decode: (d) => d as Earnings,
  },
  payouts: {
    method: "GET",
    path: () => "/me/payouts",
    params: (i) => ({ offset: i.offset ?? 0, limit: 20 }),
    decode: (d) => d as Payout[],
  },
  payout: {
    method: "GET",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/payout`,
    decode: (d) => d as Payout,
  },
  refunds: {
    method: "GET",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/refunds`,
    decode: (d) => d as Refund[],
  },
  payoutAccounts: {
    method: "GET",
    path: () => "/me/payout-accounts",
    decode: (d) => d as PayoutAccount[],
  },
  payoutBanks: {
    method: "GET",
    path: () => "/payout-banks",
    decode: (d) => d as PayoutBank[],
  },
  onboarding: {
    method: "GET",
    path: () => "/me/provider-onboarding",
    decode: (data) => data as ProviderOnboarding,
  },
};
export const commandEndpoints: {
  [K in CommandName]: Endpoint<
    CommandContract[K][0],
    CommandContract[K][1]
  > | null;
} = {
  adminCommand: {method:i=>adminCommands[i.operation].method,path:i=>operationPath(adminCommands[i.operation].path,i.params),body:i=>i.values,decode:d=>d as AdminResponse},
  openDispute: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/disputes`,
    body: (i) => ({
      reason: i.reason.trim(),
      description: i.description.trim(),
    }),
    decode: (d) => d as Dispute,
  },
  createProviderProfile: {
    method: "POST",
    path: () => "/me/provider-profile",
    body: (i) => i,
    decode: (d) => d as OwnProviderProfile,
  },
  updateProviderProfile: {
    method: "PATCH",
    path: () => "/me/provider-profile",
    body: (i) => i,
    decode: (d) => d as OwnProviderProfile,
  },
  createProviderService: {
    method: "POST",
    path: () => "/services",
    body: (i) => i,
    decode: (d) => d as OwnProviderService,
  },
  updateProviderService: {
    method: "PATCH",
    path: (i) => `/me/services/${encodeURIComponent(i.id)}`,
    body: (i) => i.values,
    decode: (d) => d as OwnProviderService,
  },
  createPortfolioItem: {
    method: "POST",
    path: () => "/me/portfolio",
    body: (i) => i,
    decode: (d) => d as OwnPortfolioItem,
  },
  updatePortfolioItem: {
    method: "PATCH",
    path: (i) => `/me/portfolio/${encodeURIComponent(i.id)}`,
    body: (i) => i.values,
    decode: (d) => d as OwnPortfolioItem,
  },
  deletePortfolioItem: {
    method: "DELETE",
    path: (i) => `/me/portfolio/${encodeURIComponent(i.id)}`,
    decode: () => ({ success: true }),
  },
  submitProviderEvidence: {
    method: "POST",
    path: () => "/me/provider-verifications",
    body: (i) => i,
    decode: (d) => d as ProviderVerification,
  },
  submitProviderProfile: {
    method: "POST",
    path: () => "/me/provider-profile/submit",
    decode: (d) => d as OwnProviderProfile,
  },
  signIn: null,
  signUp: null,
  resetPassword: null,
  forgotPassword: {
    method: "POST",
    path: () => "/auth/forgot-password",
    body: (i) => i,
    decode: () => ({ accepted: true }),
  },
  signOut: null,
  updateAccountProfile: {
    method: "PATCH",
    path: () => "/me/profile",
    body: (i) => ({
      fullName: i.fullName,
      avatarUrl: i.avatarUrl,
      universityId: i.universityId,
      campusId: i.campusId,
    }),
    decode: () => ({ success: true }),
  },
  requestEmailChange: {
    method: "POST",
    path: () => "/me/email-change",
    body: (i) => ({ email: i.email.trim(), password: i.password }),
      decode: (d) => d as EmailChangeChallenge,
  },
  confirmEmailChange: {
    method: "POST",
    path: () => "/me/email-change/confirm",
    body: (i) => ({ challengeId: i.challengeId, code: i.code }),
    decode: () => ({ success: true }),
  },
  changePassword: {
    method: "POST",
    path: () => "/me/password",
    body: (i) => ({
      currentPassword: i.currentPassword,
      newPassword: i.newPassword,
    }),
    decode: () => ({ success: true }),
  },
  deactivateAccount: {
    method: "DELETE",
    path: () => "/me/account",
    body: (i) => ({ reason: i.reason.trim() }),
    decode: () => ({ success: true }),
  },
  updateProviderSettings: {
    method: "PATCH",
    path: () => "/me/provider-profile",
    body: (i) => ({
      professionalTitle: i.professionalTitle,
      bio: i.bio,
      coverImageUrl: i.coverImageUrl,
      responseTimeMinutes: i.responseTimeMinutes,
      availability: i.availability,
    }),
    decode: (d) => d as OwnProviderProfile,
  },
  setProviderStatus: {
    method: "PATCH",
    path: () => "/me/provider-profile/status",
    body: (i) => ({ status: i.status }),
    decode: (d) => d as OwnProviderProfile,
  },
  createRequest: {
    method: "POST",
    path: () => "/requests",
    body: (i) => i,
    decode: (d) => d as HiringRequest,
  },
  createQuote: {
    method: "POST",
    path: () => "/quotes",
    body: (i) => i,
    decode: (d) => d as HiringQuote,
  },
  acceptQuote: {
    method: "POST",
    path: (i) => `/quotes/${encodeURIComponent(i.quoteId)}/accept`,
    decode: (d) => d as HiringJob,
  },
  closeRequest: {
    method: "POST",
    path: (i) => `/requests/${encodeURIComponent(i.id)}/${i.action}`,
    body: (i) => ({ reason: i.reason }),
    decode: (d) => d as HiringRequest,
  },
  closeQuote: {
    method: "POST",
    path: (i) => `/quotes/${encodeURIComponent(i.id)}/${i.action}`,
    body: (i) => ({ reason: i.reason }),
    decode: (d) => d as HiringQuote,
  },
  startJob: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/start`,
    decode: (d) => d as HiringJob,
  },
  markJobComplete: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/mark-complete`,
    decode: (d) => d as HiringJob,
  },
  cancelJob: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/cancel`,
    body: (i) => ({ reason: i.reason }),
    decode: (d) => d as HiringJob,
  },
  createMilestone: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/milestones`,
    body: (i) => ({
      title: i.title,
      description: i.description,
      dueAt: i.dueAt,
    }),
    decode: (d) => d as Milestone,
  },
  updateMilestone: {
    method: "PATCH",
    path: (i) =>
      `/jobs/${encodeURIComponent(i.jobId)}/milestones/${encodeURIComponent(i.id)}`,
    body: (i) => ({ status: i.status }),
    decode: (d) => d as Milestone,
  },
  sendMessage: {
    method: "POST",
    path: (i) =>
      `/conversations/${encodeURIComponent(i.conversationId)}/messages`,
    body: (i) => ({ content: i.content }),
    decode: (d) => d as Message,
  },
  readConversation: {
    method: "PATCH",
    path: (i) => `/conversations/${encodeURIComponent(i.conversationId)}/read`,
    decode: (d) => d as ReadResult,
  },
  realtimeTicket: {
    method: "POST",
    path: () => "/auth/socket-ticket",
    decode: (d) => ({
      ...(d as Pick<RealtimeTicket, "ticket" | "expiresAt">),
      ...socketConfiguration(),
    }),
  },
  readNotification: {
    method: "PATCH",
    path: (i) => `/notifications/${encodeURIComponent(i.id)}/read`,
    decode: (data) => notification(data as ApiNotification),
  },
  submitReview: {
    method: "POST",
    path: () => "/reviews",
    body: (i) => ({ jobId: i.jobId, rating: i.rating, comment: i.body.trim() }),
    decode: (d) => review(d as ApiReview),
  },
  requestVerificationCode: {
    method: "POST",
    path: () => "/me/student-verification/email-challenges",
    body: (i) => i,
    decode: (data) => data as EmailChallenge,
  },
  confirmVerificationCode: {
    method: "POST",
    path: () => "/me/student-verification/email-challenges/confirm",
    body: (i) => i,
    decode: (data) => data as StudentVerification,
  },
  createUpload: {
    method: "POST",
    path: () => "/uploads/presign",
    body: (i) => i,
    decode: (data) => data as UploadTicket,
  },
  createAvatarUpload: {
    method: "POST",
    path: () => "/uploads/avatar",
    body: (i) => i,
    decode: (data) => data as AvatarUploadTicket,
  },
  completeAvatarUpload: {
    method: "POST",
    path: () => "/uploads/avatar/complete",
    body: (i) => i,
    decode: (data) => data as { avatarUrl: string },
  },
  createProviderCoverUpload: {
    method: "POST",
    path: () => "/uploads/provider-cover",
    body: (i) => i,
    decode: (data) => data as ProviderCoverUploadTicket,
  },
  completeProviderCoverUpload: {
    method: "POST",
    path: () => "/uploads/provider-cover/complete",
    body: (i) => i,
    decode: (data) => data as { coverImageUrl: string },
  },
  completeUpload: {
    method: "POST",
    path: (i) => `/uploads/${encodeURIComponent(i.id)}/complete`,
    decode: (data) => data as PrivateUpload,
  },
  deleteUpload: {
    method: "DELETE",
    path: (i) => `/uploads/${encodeURIComponent(i.id)}`,
    decode: () => ({ success: true }),
  },
  submitVerification: {
    method: "POST",
    path: () => "/me/student-verification",
    body: (i) => i,
    decode: (data) => data as StudentVerification,
  },
  saveOnboarding: {
    method: "PATCH",
    path: (i) =>
      `/me/provider-onboarding/steps/${encodeURIComponent(({ service: "services", verification: "evidence" } as Record<string, string>)[i.step] ?? i.step)}`,
    body: (i) => ({ values: i.values }),
    decode: (d) => d as ProviderOnboarding,
  },
  publishProvider: {
    method: "POST",
    path: () => "/me/provider-profile/publish",
    decode: (d) => d as OwnProviderProfile,
  },
  checkout: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/payments`,
    decode: (d) => d as Checkout,
  },
  verifyPayment: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/payment/verify`,
    decode: (d) => d as Payment,
  },
  addPayoutAccount: {
    method: "POST",
    path: () => "/me/payout-accounts",
    body: (i) => i,
    decode: (d) => d as PayoutAccount,
  },
  removePayoutAccount: {
    method: "DELETE",
    path: (i) => `/me/payout-accounts/${encodeURIComponent(i.id)}`,
    decode: () => ({ success: true }),
  },
  confirmCompletion: {
    method: "POST",
    path: (i) => `/jobs/${encodeURIComponent(i.jobId)}/confirm-completion`,
    decode: (d) => d as HiringJob,
  },
  contact: {
    method: "POST",
    path: () => "/contact",
    body: (i) => i,
    decode: () => ({ accepted: true }),
  },
};
