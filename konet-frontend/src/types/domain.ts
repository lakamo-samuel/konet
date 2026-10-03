export type VerificationStatus =
  | "unverified"
  | "not_submitted"
  | "requires_more_information"
  | "pending"
  | "verified"
  | "rejected";
export interface University {
  id: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  campuses: string[];
  campusOptions?: { id: string; name: string }[];
}
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  universityId: string;
  campus: string;
  studentVerification: VerificationStatus;
  identityVerification: VerificationStatus;
  providerProfileId?: string;
  campusId?: string;
  roles?: string[];
}
export interface ProviderVerification {
  identity: VerificationStatus;
  work: VerificationStatus;
  cac?: VerificationStatus;
}
export interface ProviderReputation {
  rating: number;
  reviewCount: number;
  completedJobs: number;
  completionRate: number;
  repeatClients: number;
  unresolvedDisputes: number;
}
export interface ProviderProfile {
  id: string;
  userId: string;
  fullName?: string;
  universityId: string;
  campus: string;
  professionalTitle: string;
  category: string;
  bio: string;
  startingPrice: number;
  available: boolean;
  priceKnown?: boolean;
  reputationKnown?: boolean;
  completedJobsKnown?: boolean;
  campusId?: string;
  responseTime: string;
  verification: ProviderVerification;
  reputation: ProviderReputation;
  coverImage: string;
  avatar: string;
}
export interface Service {
  id: string;
  providerId: string;
  name: string;
  description: string;
  startingPrice: number;
  pricingUnit: string;
  active: boolean;
}
export interface PortfolioItem {
  description?: string;
  externalUrl?: string;
  id: string;
  providerId: string;
  title: string;
  category: string;
  image: string;
  alt: string;
}
export interface Conversation {
  id: string;
  jobId?: string;
  participantIds: string[];
  updatedAt: string;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  system?: boolean;
}
export interface Review {
  id: string;
  jobId: string;
  providerId: string;
  authorId: string;
  rating: number;
  body: string;
  service: string;
  verifiedJob: boolean;
  createdAt: string;
}
export interface Notification {
  id: string;
  userId: string;
  type:
    | "request"
    | "quote"
    | "payment"
    | "job"
    | "review"
    | "verification"
    | "dispute";
  title: string;
  body: string;
  read: boolean;
  href: string;
  createdAt: string;
}
