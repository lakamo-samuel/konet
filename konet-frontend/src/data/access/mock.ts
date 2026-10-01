import * as work from "@/data/mock/jobs";
import * as catalog from "@/data/mock/providers";
import { users } from "@/data/mock/users";
import { universities } from "@/data/mock/universities";
import type { CommandContract, CommandName, DataContext, DataSource, OnboardingDraft, QueryContract, QueryName } from "./contracts";
import { DataError, required } from "./errors";

function seed() {
  const state = structuredClone({ ...work, ...catalog, users, universities });
  state.quotes.forEach(quote => { quote.expiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); });
  return { ...state, drafts: {} as Record<string, OnboardingDraft> };
}
type Store = ReturnType<typeof seed>;
const host = globalThis as typeof globalThis & { __konetMock?: Store };
const state = host.__konetMock ??= seed();
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const current = (context: DataContext) => required(state.users.find(user => user.id === (context.userId ?? "samuel")), "Please sign in again.");
const providerFor = (context: DataContext) => required(state.providers.find(provider => provider.id === (context.providerId ?? current(context).providerProfileId)), "Complete your provider profile first.");

type Queries = { [K in QueryName]: (input: QueryContract[K][0], context: DataContext) => QueryContract[K][1] };
const queries: Queries = {
  universities: () => state.universities,
  university: ({ id }) => state.universities.find(item => item.id === id) ?? null,
  providers: criteria => state.providers.filter(item => (!criteria.query || `${item.fullName ?? item.id} ${item.professionalTitle} ${item.category} ${item.bio}`.toLowerCase().includes(criteria.query.toLowerCase())) && (!criteria.category || item.category === criteria.category) && (!criteria.universityId || item.universityId === criteria.universityId) && (!criteria.maxPrice || item.startingPrice <= criteria.maxPrice) && (!criteria.available || item.available)),
  provider: ({ id }) => state.providers.find(item => item.id === id) ?? null,
  services: ({ providerId }) => state.services.filter(item => item.providerId === providerId),
  portfolio: ({ providerId }) => state.portfolio.filter(item => item.providerId === providerId),
  reviews: ({ providerId }) => state.reviews.filter(item => item.providerId === providerId),
  currentUser: (_, context) => ({ ...current(context), providerProfileId: context.providerId ?? current(context).providerProfileId }),
  user: ({ id }) => state.users.find(item => item.id === id) ?? null,
  jobs: ({ userId }, context) => state.jobs.filter(item => item.clientId === userId || item.providerId === (context.providerId ?? state.users.find(user => user.id === userId)?.providerProfileId)),
  job: ({ id }) => state.jobs.find(item => item.id === id) ?? null,
  requests: ({ providerId }) => state.requests.filter(item => item.providerId === providerId),
  request: ({ id }) => state.requests.find(item => item.id === id) ?? null,
  quote: ({ id }) => state.quotes.find(item => item.id === id) ?? null,
  conversations: ({ userId }) => state.conversations.filter(item => item.participantIds.includes(userId)),
  conversation: ({ id }) => state.conversations.find(item => item.id === id) ?? null,
  messages: ({ conversationId }) => state.messages.filter(item => item.conversationId === conversationId),
  notifications: ({ userId }) => state.notifications.filter(item => item.userId === userId),
  transaction: ({ jobId }) => state.transactions.find(item => item.jobId === jobId) ?? null,
  onboarding: (_, context) => state.drafts[current(context).id] ?? {},
};
type Commands = { [K in CommandName]: (input: CommandContract[K][0], context: DataContext) => CommandContract[K][1] };
const commands: Commands = {
  signIn: ({ email }) => {
    const user = state.users.find(item => item.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new DataError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    return user;
  },
  signUp: ({ name, email }) => {
    if (state.users.some(user => user.email.toLowerCase() === email.toLowerCase())) throw new DataError("An account with this email already exists.");
    const user = { ...state.users[0], id: id(), name, email, avatar: "", studentVerification: "unverified" as const, identityVerification: "unverified" as const, providerProfileId: undefined };
    state.users.push(user); return user;
  },
  forgotPassword: () => ({ accepted: true }),
  signOut: () => ({ success: true }),
  saveProfile: (input, context) => Object.assign(current(context), input),
  saveProvider: (input, context) => Object.assign(providerFor(context), input),
  saveService: (input, context) => {
    const provider = providerFor(context);
    if (provider.id !== input.providerId) throw new DataError("You can only edit your own services.", 403);
    const existing = input.id ? required(state.services.find(item => item.id === input.id && item.providerId === provider.id)) : null;
    if (existing) return Object.assign(existing, input);
    const service = { ...input, id: id(), active: true }; state.services.push(service); return service;
  },
  createRequest: (input, context) => {
    const service = required(state.services.find(item => item.id === input.serviceId && item.providerId === input.providerId));
    const request = { id: id(), clientId: current(context).id, providerId: input.providerId, service: service.name, requestedDate: input.date, requestedTime: input.time, location: input.location, budgetMin: input.budgetMin, budgetMax: input.budgetMax, details: input.details, status: "pending" as const };
    state.requests.unshift(request); return request;
  },
  createQuote: (input, context) => {
    const request = required(state.requests.find(item => item.id === input.requestId && item.providerId === providerFor(context).id));
    const quote = { ...input, id: id(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), status: "pending" as const };
    state.quotes.push(quote); request.status = "quoted";
    state.notifications.unshift({ id: id(), userId: request.clientId, type: "quote", title: "Your quote is ready", body: `A quote is ready for ${request.service}.`, read: false, href: `/quotes/${quote.id}`, createdAt: now() });
    return quote;
  },
  acceptQuote: ({ quoteId }, context) => {
    const quote = required(state.quotes.find(item => item.id === quoteId));
    const request = required(state.requests.find(item => item.id === quote.requestId && item.clientId === current(context).id));
    const existing = state.jobs.find(item => item.quoteId === quote.id);
    if (existing) return existing;
    if (quote.status !== "pending" || Date.parse(quote.expiresAt) <= Date.now()) throw new DataError("This quote is no longer available.", 409);
    quote.status = "accepted";
    const job = { id: id(), requestId: request.id, quoteId, clientId: request.clientId, providerId: request.providerId, service: request.service, date: request.requestedDate, time: request.requestedTime, location: request.location, amount: quote.amount, status: "quoted" as const };
    state.jobs.unshift(job); state.transactions.push({ id: id(), jobId: job.id, amount: job.amount, platformFee: 0, status: "unfunded" });
    const provider = required(state.providers.find(item => item.id === request.providerId));
    state.conversations.push({ id: id(), jobId: job.id, participantIds: [request.clientId, provider.userId], updatedAt: now() });
    return job;
  },
  sendMessage: ({ conversationId, body }, context) => {
    required(state.conversations.find(item => item.id === conversationId && item.participantIds.includes(current(context).id)));
    const message = { id: id(), conversationId, senderId: current(context).id, body, createdAt: now() }; state.messages.push(message); return message;
  },
  readNotification: ({ id }, context) => Object.assign(required(state.notifications.find(item => item.id === id && item.userId === current(context).id)), { read: true }),
  submitReview: ({ jobId, rating, body }, context) => {
    const job = required(state.jobs.find(item => item.id === jobId && item.clientId === current(context).id));
    if (state.reviews.some(item => item.jobId === jobId)) throw new DataError("You have already reviewed this job.", 409);
    const review = { id: id(), jobId, providerId: job.providerId, authorId: current(context).id, rating, body, service: job.service, verifiedJob: true, createdAt: now() }; state.reviews.push(review); job.status = "reviewed"; return review;
  },
  submitVerification: ({ universityId }, context) => {
    required(state.universities.find(item => item.id === universityId));
    Object.assign(current(context), { universityId, studentVerification: "verified" }); return { status: "verified" };
  },
  saveOnboarding: ({ step, values }, context) => {
    const draft = state.drafts[current(context).id] ??= {}; draft[step] = values; return draft;
  },
  publishProvider: (_, context) => {
    const user = current(context);
    if (user.providerProfileId) return { providerId: user.providerProfileId };
    const draft = state.drafts[user.id] ?? {};
    if (!draft.profile?.title || !draft.service?.name) throw new DataError("Complete your profile and first service before publishing.");
    const provider = { ...state.providers[0], id: id(), userId: user.id, fullName: user.name, universityId: user.universityId, campus: user.campus, professionalTitle: draft.profile.title, bio: draft.profile.bio, category: draft.profile.category, startingPrice: Number(draft.service.price), reputation: { rating: 0, reviewCount: 0, completedJobs: 0, completionRate: 0, repeatClients: 0, unresolvedDisputes: 0 } };
    state.providers.push(provider); user.providerProfileId = provider.id;
    state.services.push({ id: id(), providerId: provider.id, name: draft.service.name, description: draft.service.description, startingPrice: Number(draft.service.price), pricingUnit: draft.service.pricing, active: true });
    return { providerId: provider.id };
  },
  checkout: ({ jobId }, context) => {
    const job = required(state.jobs.find(item => item.id === jobId && item.clientId === current(context).id));
    const transaction = required(state.transactions.find(item => item.jobId === jobId));
    transaction.status = "protected"; job.status = "funded"; return { status: "protected" };
  },
  confirmCompletion: ({ jobId }, context) => {
    const job = required(state.jobs.find(item => item.id === jobId && item.clientId === current(context).id));
    if (job.status !== "delivered") throw new DataError("The provider must mark the work delivered first.", 409);
    job.status = "released"; required(state.transactions.find(item => item.jobId === jobId)).status = "released"; return job;
  },
  contact: () => ({ accepted: true }),
};
export const mockSource: DataSource = {
  async query(name, input, context) { return structuredClone(queries[name](input as never, context)); },
  async command(name, input, context) { return structuredClone(commands[name](input as never, context)); },
};
