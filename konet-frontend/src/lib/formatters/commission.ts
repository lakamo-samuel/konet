import type { CommissionPolicy } from "@/types/payments";

// Estimate only: quotes and payment responses provide the authoritative snapshot.
export function previewCommission(
  amountMinor: number,
  policy: CommissionPolicy,
) {
  const platformFeeMinor = Math.floor(
    (amountMinor * policy.commissionBasisPoints) / 10000,
  );
  return {
    platformFeeMinor,
    providerAmountMinor: amountMinor - platformFeeMinor,
  };
}
