# Frontend Paystack payments and earnings

## Payment flow

An accepted quote creates a job awaiting payment. The client can open `/checkout/{jobId}` from the job and select **Continue to Paystack**. The centralized endpoint registry calls `POST /jobs/{jobId}/payments` without a body. The backend selects the stored amount, currency, payer and persistent reference. The frontend accepts only HTTPS links on `checkout.paystack.com` before redirecting. Konet no longer collects card numbers, expiry dates or CVVs, and the simulated protected-payment success state has been removed.

New backend checkout initializations append `jobId` to the configured callback URL while preserving other query parameters. The standard route is `/payment-result?jobId=<uuid>&reference=<paystack-reference>`. The authenticated result page reads the job's private payment, checks a supplied reference against the stored gateway reference, and verifies a pending/processing/failed transaction through `POST /jobs/{jobId}/payment/verify`. Visiting a return URL never grants payment success. Ownership and financial checks remain on the backend. The frontend periodically reads the payment and job; it does not repeatedly issue gateway verification requests in the background.

Existing cached checkout URLs retain their original callback. Returns without a job ID direct the client to their jobs, where **Verify payment** checks the stored transaction. Expired sessions use the existing sign-in/refresh flow and preserve the result URL. A mismatched reference displays an error without requesting verification. Pending verification stays pending, and errors remain visible for manual retry. Initialization retries reuse the backend's cached reference and URL; ambiguous or expired gateway attempts may require support/reconciliation rather than another charge.

Job pages show the actual payment states and refund records. Work starts only after backend verification schedules the job. Client completion queues a payout; `release_pending` is labelled as queued, and `released` reflects confirmed transfer success. The UI makes no escrow or protected-reserve claim. It follows Paystack's [hosted redirect and verification guidance](https://paystack.com/docs/payments/accept-payments/).

## Provider earnings and bank accounts

`/provider/earnings` uses `/me/earnings` totals for the entire provider ledger, independently of paginated history. Earned, awaiting payout and paid-out amounts are distinct; pending payouts do not count as paid. Payment history includes jobs the account hired or provided. Payment and payout histories have separate pagination and refresh periodically.

The bank form reads supported banks and the provider's active payout accounts. Approved providers submit a bank code and ten-digit account number to the existing backend resolution/recipient endpoint. The displayed record includes the resolved name, bank code, status and last four digits. The input clears after success and is not stored in browser persistence. Removing an account requires confirmation; backend errors for reserved accounts are displayed. Full numbers and private recipient identifiers are not returned in account records.

## Configuration

Backend settings already have placeholders in `.env` and `.env.example`:

- `PAYSTACK_SECRET_KEY`: test secret for sandbox testing; remains server-side.
- `PAYMENT_CALLBACK_URL`: frontend `/payment-result` URL. The backend adds the job ID; do not hard-code one. Otherwise the route defaults to `/payment-result` on `FRONTEND_URL`.
- `PAYSTACK_TRANSFERS_ENABLED`: remains false until the merchant's balance/transfer configuration is ready.

No frontend Paystack secret or public-key setting is needed for hosted checkout. Restart/redeploy the backend to include the job-ID callback change. Old cached links continue to work through manual verification in the job. Production backend callback configuration requires HTTPS; a teammate testing a deployed API from localhost can check the result in the job if the canonical callback opens the deployed frontend. CORS and frontend development token transport remain independently configured as documented in `frontend-api-integration.md`.

## Validation and remaining work

Frontend typecheck, lint, production build, HTTP journeys in production-cookie and development-token modes, and `npm run test:payment-redirect` cover integration contracts and redirect-origin validation. The HTTP fixture exercises missing gateway configuration, retries returning the same checkout, ignored browser-supplied amounts, pending verification, scheduled work only after simulated success, participant access, bank account validation/privacy/removal and queued versus paid payout totals. It sends no emails and makes no Paystack calls.

Backend PostgreSQL integration tests assert the new callback job ID and exercise existing collection, transfer, refund, webhook and hiring transitions with mocked gateway calls against a disposable database. Browser interactions, actual Paystack test checkout/redirects, merchant transfer authorization and deployed webhooks still need deployment checks with configured sandbox credentials. No migration is required for this stage.

Socket.IO conversations are connected; see [frontend messaging](frontend-messaging.md). Completed-job reviews are connected; see [frontend reviews](frontend-reviews.md). Participant disputes and account/provider settings are connected; see `frontend-disputes.md` and `frontend-settings.md`. Next: deployment verification. Admin frontend remains deferred. Reconciliation and operational recovery remain backend limitations described in `backend-payments.md` and `backend-settlements.md`.

## Commission disclosure

Quote creation fetches the backend public commission policy and shows estimated commission and provider earnings before sending. Submission waits for policy loading to succeed. The backend quote snapshot is authoritative. Quote details and payment details show actual saved commission and provider earnings, including legacy zero-commission agreements. Konet covers transaction fees; clients pay the quoted total. Provider earnings totals and payouts already use the net saved provider amount. See [backend commission policy](backend-commission.md).
