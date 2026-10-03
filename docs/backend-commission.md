# Commission policy

New quotes carry a 10% commission deducted from the gross quoted price. The client pays exactly the quote amount; the provider receives gross minus commission. Konet absorbs gateway, payout and any future custody fees from its own margin. No extra client fee or provider transaction-fee deduction is implemented. This policy does not guarantee profitability and does not introduce escrow custody.

`GET /api/v1/payments/policy` is public and returns `commissionBasisPoints: 1000`, `transactionFeePayer: platform`, and `rounding: floor`. The backend policy lives in `src/modules/marketplace/commission.ts`. Frontend previews fetch this policy; authoritative amounts are returned on quotes and payments.

Quotes snapshot `commissionBasisPoints` and `platformFeeMinor` at creation. All quote responses expose `providerAmountMinor` as gross minus saved commission. Acceptance copies those values into the payment atomically. No browser-supplied fee is accepted. The payout worker pays only the saved provider amount. Integer kobo commission rounds down, leaving any fractional kobo with the provider. For a ₦10,000 quote: client pays ₦10,000, provider receives ₦9,000, and platform commission is ₦1,000 before costs.

Migration `0011_flat_masque` adds quote snapshots with zero defaults: all existing quotes keep their prior zero-commission terms, including quotes accepted after deployment. Existing payments and payouts are untouched. Changing the policy code later affects only newly created quotes.

Commission on a pending/funded payment is an allocation, not earned revenue. Treat it as earned only once the payment is `released` after a verified successful provider transfer. Processing payouts and disputes are not earned commission; reversals require adjustment. Full refunds return the original gross payment, including allocated commission. Gateway costs that are not returned remain Konet's responsibility. No separate platform bank transfer, revenue dashboard, expense ledger, or reconciliation system is added here; retained merchant funds must not be confused with profit or available operating money.

Apply the migration before deploying this backend. Pricing, custody eligibility, merchant balances, and actual fees still require deployment configuration and commercial confirmation.
