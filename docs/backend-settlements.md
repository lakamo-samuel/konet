# Payout and refund integration

This stage implements Nigerian bank accounts, client-approved payouts, finance-authorized full refunds and signed transfer/refund events. Apply migration `0007_unique_phalanx.sql` before using it. Amounts are integer NGN kobo.

## Bank accounts

Authenticated `GET /payout-banks` returns supported banks. Approved providers submit `bankCode` (3–9 digits) and `accountNumber` (10 digits) to `POST /me/payout-accounts`. Paystack resolves the name and creates a private recipient. Responses expose the name, bank code and last four digits; full numbers are not persisted, and recipient codes and fingerprints remain private. One account may be active; submitting the same account again returns the existing record.

`GET /me/payout-accounts` reads own accounts. `DELETE /me/payout-accounts/{id}` deactivates an account unless a pending or processing payout reserves it.

## Payouts

Client confirmation atomically completes the job, reserves one payout and sets payment to `release_pending`. Retries cannot duplicate payouts. Without an account, the worker waits for account setup.

Configure `PAYSTACK_SECRET_KEY`; set `PAYSTACK_TRANSFERS_ENABLED=true` when the merchant balance and transfer settings are ready. Its environment placeholder defaults to `false`. The worker runs every 30 seconds outside tests, using database leases and stable transfer references.

Transfers require verified collection, a completed job, an active account, an eligible provider and no blocking dispute. The worker independently verifies reference, amount, currency and recipient. Only verified success marks payout `succeeded` and payment `released`. A reversal marks payment `disputed`. Pending or OTP-required transfers remain processing; complete merchant authorization in Paystack.

After an ambiguous request, the worker verifies the same reference instead of issuing another transfer. Active admin/finance staff can submit a reason to `POST /admin/payouts/{id}/retry` for server-confirmed failed transfers. This reuses the original reference and recipient; ambiguous outcomes and reversals cannot be retried here.

Participants read `/jobs/{jobId}/payout`. Providers read `/me/payouts` and `/me/earnings`; earnings distinguish completed earned funds, pending earnings and verified paid-out funds. Admin/finance read `/admin/payouts` and `/admin/payouts/{id}`.

## Full refunds

Active admin/finance staff submit the full original `amountMinor` and a `reason` of 3–2000 characters to `POST /admin/payments/{id}/refunds`. Self-approval is forbidden. Verified collection is required; completed jobs, payout reservations and open disputes prevent this action. One full refund is allowed per payment; partial refunds are unsupported.

The transaction cancels the job and durably queues the refund. HTTP 202 acknowledges the queue, not returned money. The worker verifies provider ID, original transaction, amount, currency and local marker. Only verified `processed` status marks payment `refunded`. Participants read `/jobs/{jobId}/refunds`.

If creation has an ambiguous outcome without a provider ID, the worker never blindly creates a second refund. A signed, independently verified refund webhook can recover it through the local marker. Otherwise manual operational recovery is needed when no provider identifier exists. Verification-only reconciliation is implemented for recorded references; see [admin operations](admin-dashboard.md). It never blindly creates a second refund.

## Events and remaining work

Paystack uses `/webhooks/payments/paystack` and `x-paystack-signature`. The API checks raw-body HMAC-SHA512 and verifies relevant financial details with Paystack. Repeated events cannot duplicate financial transitions. Audits and participant notifications commit with financial changes; Socket.IO events publish after commit.

Verification-only durable reconciliation is implemented; partial refunds and broader operational recovery tooling remain outside the implemented scope. See [admin operations](admin-dashboard.md). Collection and ledger states do not establish regulated escrow. New quote commission is 10%, with transaction fees absorbed by Konet; see [commission policy](backend-commission.md).

Admin/finance dispute outcomes can also authorize a payout or full refund. See [dispute integration](backend-disputes.md).
