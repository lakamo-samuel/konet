import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    readFileSync("src/lib/formatters/money-input.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  context,
);
const { ngnToMinor, futureDate } = context.exports;
assert.equal(ngnToMinor("1500.50"), 150050);
assert.equal(ngnToMinor("0.29"), 29);
assert.equal(ngnToMinor("21474836.47"), 2147483647);
assert.equal(ngnToMinor("", true), undefined);
for (const value of ["-1", "1.001", "1e3", "21474836.48"])
  assert.throws(() => ngnToMinor(value));
assert.equal(futureDate(""), undefined);
assert.throws(() => futureDate("2000-01-01T00:00"));
assert.throws(() => futureDate("not a date"));
const date = new Date(Date.now() + 86400000).toISOString();
assert.equal(futureDate(date), date);
console.log(
  "NGN precision, integer limits, optional amounts and future-date checks passed.",
);

const pricingContext = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(readFileSync("src/lib/formatters/commission.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  pricingContext,
);
const { previewCommission } = pricingContext.exports;
for (const amount of [1, 9, 10, 101, 1000000, 2147483647]) {
  const result = previewCommission(amount, {
    commissionBasisPoints: 1000,
    rounding: "floor",
    transactionFeePayer: "platform",
  });
  assert.equal(result.platformFeeMinor, Math.floor(amount / 10));
  assert.equal(result.providerAmountMinor + result.platformFeeMinor, amount);
}
assert.equal(
  previewCommission(1000, { commissionBasisPoints: 500 }).platformFeeMinor,
  50,
);
console.log(
  "Commission preview uses the server rate, preserves minor units and rounds down.",
);
