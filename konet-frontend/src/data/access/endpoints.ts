import type { CommandContract, CommandName, QueryContract, QueryName } from "./contracts";
import type { ProviderProfile, Service, University } from "@/types/domain";

export type Endpoint<I, O> = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: (input: I) => string; params?: (input: I) => unknown; body?: (input: I) => unknown; decode: (data: unknown) => O };
type ApiService = { id: string; providerId: string; title: string; description: string; priceMinor: number | null; pricingType: string; status: string };
type ApiProvider = { id: string; userId: string; fullName: string; universityId: string; campusName?: string; professionalTitle: string; bio: string; availability: string; responseTimeMinutes: number; coverImageUrl: string | null; avatarUrl: string | null; reputation?: { rating: number; reviewCount: number }; verification?: { dimension: string; status: string }[]; services?: ApiService[] };
const service = (data: ApiService): Service => ({ id: data.id, providerId: data.providerId, name: data.title, description: data.description, startingPrice: (data.priceMinor ?? 0) / 100, pricingUnit: data.pricingType, active: data.status === "active" });
const provider = (data: ApiProvider): ProviderProfile => ({ id: data.id, userId: data.userId, fullName: data.fullName, universityId: data.universityId, campus: data.campusName ?? "", professionalTitle: data.professionalTitle, category: data.services?.[0]?.title ?? data.professionalTitle, bio: data.bio, startingPrice: (data.services?.[0]?.priceMinor ?? 0) / 100, available: data.availability === "available", responseTime: `Usually responds within ${data.responseTimeMinutes} minutes`, verification: { identity: data.verification?.some(item => item.dimension === "identity" && item.status === "verified") ? "verified" : "unverified", work: data.verification?.some(item => item.dimension === "work" && item.status === "verified") ? "verified" : "unverified" }, reputation: { rating: data.reputation?.rating ?? 0, reviewCount: data.reputation?.reviewCount ?? 0, completedJobs: 0, completionRate: 0, repeatClients: 0, unresolvedDisputes: 0 }, coverImage: data.coverImageUrl ?? "", avatar: data.avatarUrl ?? "" });
const university = (data: Omit<University, "campuses"> & { campuses: { name: string }[] }): University => ({ ...data, campuses: data.campuses.map(item => item.name) });

// This is the integration registry. Add a path, request mapper and response decoder here
// once an endpoint contract is agreed. A missing endpoint fails explicitly; it never falls back to fixtures.
export const queryEndpoints: { [K in QueryName]: Endpoint<QueryContract[K][0], QueryContract[K][1]> | null } = {
  universities: { method: "GET", path: () => "/universities", decode: data => (data as Parameters<typeof university>[0][]).map(university) },
  university: { method: "GET", path: input => `/universities/${encodeURIComponent(input.id)}`, decode: data => data ? university(data as Parameters<typeof university>[0]) : null },
  providers: { method: "GET", path: () => "/providers", params: input => ({ query: input.query, universityId: input.universityId, availability: input.available ? "available" : undefined }), decode: data => (data as ApiProvider[]).map(provider) },
  provider: { method: "GET", path: input => `/providers/${encodeURIComponent(input.id)}`, decode: data => data ? provider(data as ApiProvider) : null },
  services: { method: "GET", path: input => `/providers/${encodeURIComponent(input.providerId)}`, decode: data => ((data as ApiProvider).services ?? []).map(service) },
  portfolio: null, reviews: null, currentUser: null, user: null, jobs: null, job: null, requests: null, request: null, quote: null, conversations: null, conversation: null, messages: null, notifications: null, transaction: null, onboarding: null,
};
export const commandEndpoints: { [K in CommandName]: Endpoint<CommandContract[K][0], CommandContract[K][1]> | null } = {
  signIn: null, signUp: null, forgotPassword: null, signOut: null, saveProfile: null, saveProvider: null, saveService: null, createRequest: null, createQuote: null, acceptQuote: null, sendMessage: null, readNotification: null, submitReview: null, submitVerification: null, saveOnboarding: null, publishProvider: null, checkout: null, confirmCompletion: null, contact: null,
};
