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
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: (input: I) => string;
  params?: (input: I) => unknown;
  body?: (input: I) => unknown;
  decode: (data: unknown) => O;
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
    decode: (data) =>
      (
        data as {
          id: string;
          jobId: string;
          providerId: string;
          clientId: string;
          rating: number;
          comment: string;
          createdAt: string;
        }[]
      ).map(
        (r) =>
          ({
            id: r.id,
            jobId: r.jobId,
            providerId: r.providerId,
            authorId: r.clientId,
            rating: r.rating,
            body: r.comment,
            service: "Completed service",
            verifiedJob: true,
            createdAt: r.createdAt,
          }) satisfies Review,
      ),
  },
  notifications: {
    method: "GET",
    path: () => "/notifications",
    params: () => ({ limit: 100 }),
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
  conversations: null,
  conversation: null,
  messages: null,
  transaction: null,
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
  saveProfile: null,
  saveProvider: null,
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
  sendMessage: null,
  readNotification: {
    method: "PATCH",
    path: (i) => `/notifications/${encodeURIComponent(i.id)}/read`,
    decode: (data) => notification(data as ApiNotification),
  },
  submitReview: null,
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
  checkout: null,
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
