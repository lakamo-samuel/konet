import type { VerificationStatus } from "./domain";
export type ProviderDimension = "identity" | "work" | "cac";
export type PricingType =
  "fixed" | "starting_from" | "per_hour" | "per_session" | "custom_quote";
export type PortfolioType =
  "image" | "external_link" | "project" | "case_study" | "certificate";
export interface OwnProviderProfile {
  id: string;
  professionalTitle: string;
  bio: string;
  responseTimeMinutes: number;
  coverImageUrl: string | null;
  availability: string;
  status: "draft" | "pending_verification" | "active" | "paused" | "suspended";
  reviewStatus:
    | "not_submitted"
    | "pending"
    | "approved"
    | "rejected"
    | "requires_more_information";
  reviewReason: string | null;
  reviewRevision: number;
  approvedAt: string | null;
}
export interface OwnProviderService {
  id: string;
  providerId: string;
  categoryId: string;
  title: string;
  description: string;
  pricingType: PricingType;
  priceMinor: number | null;
  currency: string;
  status: "draft" | "active" | "paused" | "archived";
}
export interface OwnPortfolioItem {
  id: string;
  type: PortfolioType;
  title: string;
  description: string | null;
  assetUrl: string | null;
  externalUrl: string | null;
}
export interface ProviderVerification {
  id: string;
  dimension: ProviderDimension;
  status: VerificationStatus;
  revision: number;
  reason: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  uploadId: string | null;
}
export interface ProviderOnboarding {
  profile: OwnProviderProfile | null;
  services: OwnProviderService[];
  portfolio: OwnPortfolioItem[];
  verification: ProviderVerification[];
  steps: Record<string, { values: Record<string, unknown>; updatedAt: string }>;
  requirements: {
    requiredDimensions: ProviderDimension[];
    optionalDimensions: ProviderDimension[];
    serviceRequired: boolean;
  };
  canSubmit: boolean;
  canPublish: boolean;
}
export interface Category {
  id: string;
  name: string;
}
export interface ProviderProfileInput {
  professionalTitle: string;
  bio: string;
  responseTimeMinutes: number;
  coverImageUrl?: string;
}
export interface ProviderServiceInput {
  categoryId: string;
  title: string;
  description: string;
  pricingType: PricingType;
  priceMinor?: number;
  currency: "NGN";
}
export interface PortfolioInput {
  type: PortfolioType;
  title: string;
  description?: string;
  assetUrl?: string;
  externalUrl?: string;
}
