export const commissionPolicy = Object.freeze({
  commissionBasisPoints: 1000,
  transactionFeePayer: "platform" as const,
  rounding: "floor" as const,
});

// Whole kobo only. Rounding down leaves any fractional kobo with the provider.
export function commissionBreakdown(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 2147483647)
    throw new RangeError("Quote amount must be a positive PostgreSQL integer in minor units.");
  const platformFeeMinor = Math.floor(amountMinor * commissionPolicy.commissionBasisPoints / 10000);
  return { ...commissionPolicy, platformFeeMinor, providerAmountMinor: amountMinor - platformFeeMinor };
}
