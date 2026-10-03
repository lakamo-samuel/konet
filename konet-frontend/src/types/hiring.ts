export type RequestStatus =
  | "pending"
  | "viewed"
  | "discussing"
  | "quoted"
  | "withdrawn"
  | "declined"
  | "converted_to_job";
export type QuoteStatus =
  "draft" | "sent" | "accepted" | "declined" | "expired" | "cancelled";
export type JobState =
  | "awaiting_payment"
  | "scheduled"
  | "in_progress"
  | "awaiting_client_confirmation"
  | "completed"
  | "cancelled"
  | "disputed";
export interface HiringRequest {
  id: string;
  clientId: string;
  providerId: string;
  serviceId: string;
  description: string;
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  currency: string;
  requestedAt: string | null;
  location: string | null;
  status: RequestStatus;
  createdAt: string;
}
export interface HiringQuote {
  id: string;
  requestId: string;
  clientId: string;
  providerId: string;
  amountMinor: number;
  currency: string;
  scope: string[];
  notes: string | null;
  deliveryAt: string | null;
  expiresAt: string;
  status: QuoteStatus;
}
export interface HiringJob {
  id: string;
  requestId: string;
  quoteId: string;
  clientId: string;
  providerId: string;
  serviceId: string;
  agreedAmountMinor: number;
  currency: string;
  status: JobState;
  scheduledAt: string | null;
  startedAt: string | null;
  providerCompletedAt: string | null;
  clientConfirmedAt: string | null;
  completedAt: string | null;
}
export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: "pending" | "in_progress" | "completed";
}
export interface RequestInput {
  providerId: string;
  serviceId: string;
  description: string;
  budgetMinMinor?: number;
  budgetMaxMinor?: number;
  requestedAt?: string;
  location?: string;
}
export interface QuoteInput {
  requestId: string;
  amountMinor: number;
  scope: string[];
  notes?: string;
  deliveryAt?: string;
  expiresAt: string;
}
