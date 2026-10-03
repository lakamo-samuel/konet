import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const context = { exports: {}, URL };
vm.runInNewContext(
  ts.transpileModule(readFileSync("src/lib/formatters/payment.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context,
);
const { paystackCheckoutUrl } = context.exports;
assert.equal(
  paystackCheckoutUrl("https://checkout.paystack.com/transaction"),
  "https://checkout.paystack.com/transaction",
);
for (const value of [
  "javascript:alert(1)",
  "http://checkout.paystack.com/test",
  "https://checkout.paystack.com.evil.example/test",
  "https://evil.example/checkout.paystack.com",
  "https://user:password@checkout.paystack.com/test",
  "https://checkout.paystack.com:444/test",
  "/relative",
])
  assert.throws(() => paystackCheckoutUrl(value));
console.log(
  "Payment redirects accept only the HTTPS Paystack checkout origin.",
);
