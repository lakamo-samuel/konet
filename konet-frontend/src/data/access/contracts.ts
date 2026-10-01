import type { Conversation, EscrowTransaction, Job, Message, Notification, PortfolioItem, ProviderProfile, Quote, Review, Service, ServiceRequest, University, User } from "@/types/domain";

export type SearchCriteria = { query?: string; category?: string; universityId?: string; maxPrice?: number; available?: boolean };
export type OnboardingDraft = Record<string, Record<string, string>>;
export type QueryContract = {
  universities: [Record<string, never>, University[]];
  university: [{ id: string }, University | null];
  providers: [SearchCriteria, ProviderProfile[]];
  provider: [{ id: string }, ProviderProfile | null];
  services: [{ providerId: string }, Service[]];
  portfolio: [{ providerId: string }, PortfolioItem[]];
  reviews: [{ providerId: string }, Review[]];
  currentUser: [Record<string, never>, User];
  user: [{ id: string }, User | null];
  jobs: [{ userId: string }, Job[]];
  job: [{ id: string }, Job | null];
  requests: [{ providerId: string }, ServiceRequest[]];
  request: [{ id: string }, ServiceRequest | null];
  quote: [{ id: string }, Quote | null];
  conversations: [{ userId: string }, Conversation[]];
  conversation: [{ id: string }, Conversation | null];
  messages: [{ conversationId: string }, Message[]];
  notifications: [{ userId: string }, Notification[]];
  transaction: [{ jobId: string }, EscrowTransaction | null];
  onboarding: [Record<string, never>, OnboardingDraft];
};
export type CommandContract = {
  signIn: [{ email: string; password: string }, User];
  signUp: [{ name: string; email: string; password: string }, User];
  forgotPassword: [{ email: string }, { accepted: boolean }];
  signOut: [Record<string, never>, { success: boolean }];
  saveProfile: [{ name: string; email: string; campus: string }, User];
  saveProvider: [{ professionalTitle: string; responseTime: string; available: boolean }, ProviderProfile];
  saveService: [{ id?: string; providerId: string; name: string; description: string; startingPrice: number; pricingUnit: string }, Service];
  createRequest: [{ providerId: string; serviceId: string; date: string; time: string; location: string; budgetMin: number; budgetMax: number; details: string }, ServiceRequest];
  createQuote: [{ requestId: string; amount: number; scope: string[]; note: string }, Quote];
  acceptQuote: [{ quoteId: string }, Job];
  sendMessage: [{ conversationId: string; body: string }, Message];
  readNotification: [{ id: string }, Notification];
  submitReview: [{ jobId: string; rating: number; body: string }, Review];
  submitVerification: [{ universityId: string; studentNumber: string; email: string }, { status: "verified" | "pending" }];
  saveOnboarding: [{ step: string; values: Record<string, string> }, OnboardingDraft];
  publishProvider: [Record<string, never>, { providerId: string }];
  checkout: [{ jobId: string }, { status: "protected" | "pending"; checkoutUrl?: string }];
  confirmCompletion: [{ jobId: string }, Job];
  contact: [{ email: string; topic: string; message: string }, { accepted: boolean }];
};
export type QueryName = keyof QueryContract;
export type CommandName = keyof CommandContract;
export type QueryInput<K extends QueryName> = QueryContract[K][0];
export type QueryResult<K extends QueryName> = QueryContract[K][1];
export type CommandInput<K extends CommandName> = CommandContract[K][0];
export type CommandResult<K extends CommandName> = CommandContract[K][1];
export type DataContext = { userId?: string; providerId?: string; accessToken?: string };
export interface DataSource {
  query<K extends QueryName>(name: K, input: QueryInput<K>, context: DataContext): Promise<QueryResult<K>>;
  command<K extends CommandName>(name: K, input: CommandInput<K>, context: DataContext): Promise<CommandResult<K>>;
}
