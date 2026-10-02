# Paystack collection integration

This payment stage implements hosted checkout, server-side verification, signed charge webhooks and participant payment history. It does not yet implement provider transfers, payout accounts, refunds or reconciliation. Payment collection is not a claim that money is held in escrow.

## Frontend flow

1. Accept a quote; the job starts `awaiting_payment` with a `pending` payment.
2. The client calls `POST /api/v1/jobs/{jobId}/payments` with a bearer token and no body. The server reads the agreed amount and currency, assigns one persistent Paystack reference and returns `{paymentId,reference,checkoutUrl}`. Redirect to `checkoutUrl`; do not collect card details in Konet.
3. On the payment result page, call `POST /api/v1/jobs/{jobId}/payment/verify`. Either participant can request verification. The server checks Paystack's response; frontend URL parameters or supplied payment statuses cannot fund the job.
4. Read `GET /api/v1/jobs/{jobId}/payment` and `GET /api/v1/jobs/{id}`. Successful verification atomically changes payment to `funded` and job to `scheduled`. Work may then start.

`GET /api/v1/me/payments` lists your client/provider payments with limit (default 20, maximum 100), offset and optional payment status. Other users receive no payment records. Direct access to another job's payment receives 404; providers cannot initialize client checkout (403).

Checkout retries return the saved URL and reference. Simultaneous initialization may return 409 `CHECKOUT_IN_PROGRESS`; retry shortly. The initialization lease expires after 60 seconds. A provider timeout returns 503 and keeps the same reference. No new reference is issued after an ambiguous response, preventing a second charge attempt for the same job. Verify before retrying. If Paystack created a transaction but the checkout response was lost, recovery may require support/reconciliation; the API will not invent another reference or mark money funded.

Pending or unsuccessful provider verification leaves the local payment processing until confirmed or reconciled. Existing checkout URLs are reused; creating fresh charge attempts for expired/failed hosted transactions is a later stage. Cancellation is blocked once checkout is processing, since the remote transaction may still settle.

## Webhooks and integrity

Configure Paystack's webhook URL as `https://YOUR_API_HOST/api/v1/webhooks/payments/paystack`. It accepts raw JSON with required `x-paystack-signature`, checked as HMAC-SHA512 over the exact bytes using the secret key. The application captures the original body; re-serializing parsed JSON is not used for signature verification. Paystack documents this contract in its [webhook guide](https://paystack.com/docs/payments/webhooks/).

A signed `charge.success` event triggers an additional server-side transaction verification. Reference, NGN currency, integer amount, payer email, payment metadata and provider transaction identity must match the stored payment. The event, funding, scheduling, audit and participant notifications commit together. The unique event reference makes retries and concurrent webhook/manual verification safe. Already processed events are acknowledged without another provider request. Other signed event types and unrelated payment references are acknowledged without changing jobs.

Invalid signatures receive 401; mismatched verification receives 422. Temporary provider errors return 503 so a webhook can be retried. No raw card data or complete gateway response is stored; payment events contain a payload hash and provider transaction identifier.

API endpoints and response fields follow Paystack's [transaction API](https://paystack.com/docs/api/transaction/). Checkout uses merchant collection with no split or immediate provider allocation. A `funded` database flag records confirmed collection; it does not prove a protected reserve or escrow arrangement. Client confirmation still leaves payment unchanged until the payout stage exists. Current platform fees remain zero.

## Configuration and deployment

Empty placeholders are in `konet-backend/.env` and `.env.example`:

- `PAYSTACK_SECRET_KEY`: use a Paystack test secret (`sk_test_…`) for sandbox testing. Keep it server-side; never place it in frontend environment variables.
- `PAYMENT_CALLBACK_URL`: optional full URL for the frontend payment result page. Defaults to `/payment-result` on `FRONTEND_URL`; production overrides must use HTTPS.

Empty optional settings allow startup; checkout returns 503 `PAYMENT_GATEWAY_NOT_CONFIGURED` until a key is supplied. Restart the backend after filling settings. No real charges were made during implementation; tests mock external Paystack calls.

Migration 0006 adds `payment_checkouts` for references, cached hosted URLs and initialization leases. Apply with `npm run db:migrate`. Automated tests use isolated databases and cover signature verification, private ownership, amount/metadata mismatches, concurrent funding, cached initialization and ambiguous response recovery.

Remaining F8 stages: payout account verification, client-authorized transfers, transfer event processing, refunds, dispute release restrictions and financial reconciliation. These remain explicitly unfinished in Swagger.
