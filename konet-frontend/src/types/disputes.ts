export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_for_client"
  | "resolved_for_provider"
  | "closed";
export interface Dispute {
  id: string;
  jobId: string;
  openedByUserId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
}
export interface DisputeDecision {
  id: string;
  disputeId: string;
  actorId: string;
  decision: "resolved_for_client" | "resolved_for_provider";
  reason: string;
  refundAmountMinor: number | null;
  createdAt: string;
}
