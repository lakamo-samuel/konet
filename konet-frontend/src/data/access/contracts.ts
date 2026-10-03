import type {
  HiringRequest,
  HiringQuote,
  HiringJob,
  Milestone,
  RequestInput,
  QuoteInput,
} from "@/types/hiring";
import type {
  ProviderOnboarding,
  OwnProviderProfile,
  ProviderProfileInput,
  OwnProviderService,
  ProviderServiceInput,
  OwnPortfolioItem,
  PortfolioInput,
  ProviderVerification,
  ProviderDimension,
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
  Conversation,
  EscrowTransaction,
  Message,
  Notification,
  PortfolioItem,
  ProviderProfile,
  Review,
  Service,
  University,
  User,
} from "@/types/domain";

export type SearchCriteria = {
  query?: string;
  category?: string;
  universityId?: string;
  maxPrice?: number;
  available?: boolean;
};
export type QueryContract = {
  categories: [Record<string, never>, Category[]];
  verificationMethods: [{ universityId: string }, VerificationMethods];
  studentVerifications: [Record<string, never>, StudentVerification[]];
  upload: [{ id: string }, PrivateUpload];
  universities: [Record<string, never>, University[]];
  university: [{ id: string }, University | null];
  providers: [SearchCriteria, ProviderProfile[]];
  provider: [{ id: string }, ProviderProfile | null];
  services: [{ providerId: string }, Service[]];
  portfolio: [{ providerId: string }, PortfolioItem[]];
  reviews: [{ providerId: string }, Review[]];
  currentUser: [Record<string, never>, User];
  user: [{ id: string }, User | null];
  jobs: [{ userId: string; offset?: number; limit?: number }, HiringJob[]];
  job: [{ id: string }, HiringJob | null];
  requests: [
    { providerId?: string; offset?: number; limit?: number },
    HiringRequest[],
  ];
  request: [{ id: string }, HiringRequest | null];
  quote: [{ id: string }, HiringQuote | null];
  requestQuotes: [{ requestId: string; offset?: number }, HiringQuote[]];
  milestones: [{ jobId: string }, Milestone[]];
  conversations: [{ userId: string }, Conversation[]];
  conversation: [{ id: string }, Conversation | null];
  messages: [{ conversationId: string }, Message[]];
  notifications: [{ userId: string }, Notification[]];
  transaction: [{ jobId: string }, EscrowTransaction | null];
  onboarding: [Record<string, never>, ProviderOnboarding];
};
export type CommandContract = {
  createProviderProfile: [ProviderProfileInput, OwnProviderProfile];
  updateProviderProfile: [ProviderProfileInput, OwnProviderProfile];
  createProviderService: [ProviderServiceInput, OwnProviderService];
  updateProviderService: [
    {
      id: string;
      values: Partial<Omit<ProviderServiceInput, "categoryId" | "currency">> & {
        status?: OwnProviderService["status"];
      };
    },
    OwnProviderService,
  ];
  createPortfolioItem: [PortfolioInput, OwnPortfolioItem];
  updatePortfolioItem: [
    { id: string; values: PortfolioInput },
    OwnPortfolioItem,
  ];
  deletePortfolioItem: [{ id: string }, { success: boolean }];
  submitProviderEvidence: [
    { dimension: ProviderDimension; evidenceObjectKey: string },
    ProviderVerification,
  ];
  submitProviderProfile: [Record<string, never>, OwnProviderProfile];
  signIn: [{ email: string; password: string }, User];
  signUp: [
    {
      name: string;
      email: string;
      password: string;
      universityId: string;
      campusId: string;
    },
    User,
  ];
  forgotPassword: [{ email: string }, { accepted: boolean }];
  resetPassword: [{ token: string; password: string }, { accepted: boolean }];
  signOut: [Record<string, never>, { success: boolean }];
  saveProfile: [{ name: string; email: string; campus: string }, User];
  saveProvider: [
    { professionalTitle: string; responseTime: string; available: boolean },
    ProviderProfile,
  ];
  createRequest: [RequestInput, HiringRequest];
  createQuote: [QuoteInput, HiringQuote];
  acceptQuote: [{ quoteId: string }, HiringJob];
  closeRequest: [
    { id: string; action: "withdraw" | "decline"; reason: string },
    HiringRequest,
  ];
  closeQuote: [
    { id: string; action: "decline" | "cancel"; reason: string },
    HiringQuote,
  ];
  startJob: [{ jobId: string }, HiringJob];
  markJobComplete: [{ jobId: string }, HiringJob];
  cancelJob: [{ jobId: string; reason: string }, HiringJob];
  createMilestone: [
    { jobId: string; title: string; description?: string; dueAt?: string },
    Milestone,
  ];
  updateMilestone: [
    { jobId: string; id: string; status: Milestone["status"] },
    Milestone,
  ];
  sendMessage: [{ conversationId: string; body: string }, Message];
  readNotification: [{ id: string }, Notification];
  submitReview: [{ jobId: string; rating: number; body: string }, Review];
  requestVerificationCode: [{ email: string }, EmailChallenge];
  confirmVerificationCode: [
    { challengeId: string; code: string },
    StudentVerification,
  ];
  createUpload: [
    {
      purpose: "student_evidence" | "provider_evidence";
      fileName: string;
      contentType: string;
      sizeBytes: number;
    },
    UploadTicket,
  ];
  completeUpload: [{ id: string }, PrivateUpload];
  deleteUpload: [{ id: string }, { success: boolean }];
  submitVerification: [
    {
      method: "student_id" | "manual_document";
      studentNumber?: string;
      evidenceObjectKey: string;
    },
    StudentVerification,
  ];
  saveOnboarding: [
    { step: string; values: Record<string, unknown> },
    ProviderOnboarding,
  ];
  publishProvider: [Record<string, never>, OwnProviderProfile];
  checkout: [
    { jobId: string },
    { status: "protected" | "pending"; checkoutUrl?: string },
  ];
  confirmCompletion: [{ jobId: string }, HiringJob];
  contact: [
    { email: string; topic: string; message: string },
    { accepted: boolean },
  ];
};
export type QueryName = keyof QueryContract;
export type CommandName = keyof CommandContract;
export type QueryInput<K extends QueryName> = QueryContract[K][0];
export type QueryResult<K extends QueryName> = QueryContract[K][1];
export type CommandInput<K extends CommandName> = CommandContract[K][0];
export type CommandResult<K extends CommandName> = CommandContract[K][1];
export type DataContext = {
  userId?: string;
  providerId?: string;
  accessToken?: string;
};
export interface DataSource {
  query<K extends QueryName>(
    name: K,
    input: QueryInput<K>,
    context: DataContext,
  ): Promise<QueryResult<K>>;
  command<K extends CommandName>(
    name: K,
    input: CommandInput<K>,
    context: DataContext,
  ): Promise<CommandResult<K>>;
}
