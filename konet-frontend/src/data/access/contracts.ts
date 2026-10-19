import type { AdminQueryInput, AdminCommandInput, AdminResponse } from "@/features/admin/operations";
import type {
  AccountProfileInput,
  AvatarUploadTicket,
  EmailChangeChallenge,
} from "@/types/account-settings";
import type { Dispute, DisputeDecision, DisputeStatus } from "@/types/disputes";
import type { RealtimeTicket, ReadResult } from "@/types/messaging";
import type {
  CommissionPolicy,
  Payment,
  PaymentStatus,
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
  Conversation,
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
  adminQuery: [AdminQueryInput, AdminResponse];
  ownProviderProfile: [Record<string, never>, OwnProviderProfile];
  disputes: [{ offset?: number; status?: DisputeStatus }, Dispute[]];
  dispute: [{ id: string }, Dispute];
  disputeDecisions: [{ id: string }, DisputeDecision[]];
  commissionPolicy: [Record<string, never>, CommissionPolicy];
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
  jobReview: [{ jobId: string }, Review | null];
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
  conversations: [{ userId: string; offset?: number }, Conversation[]];
  conversation: [{ id: string }, Conversation | null];
  messages: [
    { conversationId: string; offset?: number; limit?: number },
    Message[],
  ];
  jobConversation: [{ jobId: string }, Conversation];
  notifications: [
    { userId: string; status?: "read" | "unread" },
    Notification[],
  ];
  payment: [{ jobId: string }, Payment];
  payments: [
    { offset?: number; limit?: number; status?: PaymentStatus },
    Payment[],
  ];
  earnings: [Record<string, never>, Earnings];
  payouts: [{ offset?: number }, Payout[]];
  payout: [{ jobId: string }, Payout | null];
  refunds: [{ jobId: string }, Refund[]];
  payoutAccounts: [Record<string, never>, PayoutAccount[]];
  payoutBanks: [Record<string, never>, PayoutBank[]];
  onboarding: [Record<string, never>, ProviderOnboarding];
};
export type CommandContract = {
  adminCommand: [AdminCommandInput, AdminResponse];
  openDispute: [
    { jobId: string; reason: string; description: string },
    Dispute,
  ];
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
  updateAccountProfile: [AccountProfileInput, { success: boolean }];
  requestEmailChange: [
    { email: string; password: string },
    EmailChangeChallenge,
  ];
  confirmEmailChange: [
    { challengeId: string; code: string },
    { success: boolean },
  ];
  changePassword: [
    { currentPassword: string; newPassword: string },
    { success: boolean },
  ];
  deactivateAccount: [{ reason: string }, { success: boolean }];
  updateProviderSettings: [
    Partial<ProviderProfileInput> & {
      availability?: "available" | "unavailable" | "limited";
    },
    OwnProviderProfile,
  ];
  setProviderStatus: [{ status: "active" | "paused" }, OwnProviderProfile];
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
  sendMessage: [{ conversationId: string; content: string }, Message];
  readConversation: [{ conversationId: string }, ReadResult];
  realtimeTicket: [Record<string, never>, RealtimeTicket];
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
  createAvatarUpload: [
    { contentType: string; sizeBytes: number },
    AvatarUploadTicket,
  ];
  completeAvatarUpload: [{ publicId: string }, { avatarUrl: string }];
  createProviderCoverUpload: [
    { contentType: string; sizeBytes: number },
    ProviderCoverUploadTicket,
  ];
  completeProviderCoverUpload: [
    { publicId: string },
    { coverImageUrl: string },
  ];
  createPortfolioImageUpload: [
    { contentType: string; sizeBytes: number },
    AvatarUploadTicket,
  ];
  completePortfolioImageUpload: [{ publicId: string }, { assetUrl: string }];
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
  checkout: [{ jobId: string }, Checkout];
  verifyPayment: [{ jobId: string }, Payment];
  addPayoutAccount: [
    { bankCode: string; accountNumber: string },
    PayoutAccount,
  ];
  removePayoutAccount: [{ id: string }, { success: boolean }];
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
