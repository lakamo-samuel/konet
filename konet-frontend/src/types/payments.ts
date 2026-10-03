export type PaymentStatus =
  | "pending"
  | "processing"
  | "funded"
  | "held"
  | "release_pending"
  | "released"
  | "failed"
  | "refunded"
  | "disputed";
export type Payment = {
  id: string;
  jobId: string;
  payerId: string;
  providerId: string;
  amountMinor: number;
  platformFeeMinor: number;
  providerAmountMinor: number;
  currency: string;
  gateway: string;
  gatewayReference: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};
export type Checkout = {
  paymentId: string;
  reference: string;
  checkoutUrl: string;
};
export type Earnings = {
  currency: string;
  earnedMinor: number;
  pendingMinor: number;
  paidOutMinor: number;
};
export type Payout = {
  id: string;
  jobId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  status: string;
  reference: string;
  createdAt: string;
};
export type Refund = {
  id: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  reason: string;
  status: string;
  createdAt: string;
};
export type PayoutAccount = {
  id: string;
  providerId: string;
  bankCode: string;
  accountName: string;
  accountNumberLast4: string;
  status: string;
  createdAt: string;
};
export type PayoutBank = { code: string; name: string };

export interface CommissionPolicy {
  commissionBasisPoints: number;
  transactionFeePayer: "platform";
  rounding: "floor";
}
