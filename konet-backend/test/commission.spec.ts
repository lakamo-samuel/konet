import { commissionBreakdown } from "../src/modules/marketplace/commission";

describe("commission policy", () => {
  it.each([1, 9, 10, 11, 101, 1000000, 2147483647])("conserves gross amount and leaves fractional kobo with provider: %i", (gross) => {
    const result = commissionBreakdown(gross);
    expect(result.platformFeeMinor).toBe(Math.floor(gross / 10));
    expect(result.providerAmountMinor + result.platformFeeMinor).toBe(gross);
    expect(result.providerAmountMinor).toBeGreaterThan(0);
    expect(result.transactionFeePayer).toBe("platform");
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])("rejects invalid money: %s", (gross) => {
    expect(() => commissionBreakdown(gross)).toThrow(RangeError);
  });
});
