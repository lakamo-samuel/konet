# Dispute integration

Apply migration `0008_powerful_spyke.sql` for immutable dispute decisions. The API freezes disputed work and lets active admin/finance staff authorize one final financial outcome. Reviewer, support and ordinary student roles cannot decide cases. Staff cannot decide a job in which they are the client or provider.

## Participant workflow

Either participant can call `POST /jobs/{id}/disputes` for funded work in `scheduled`, `in_progress` or `awaiting_client_confirmation`. Send `reason` (3–100 characters) and `description` (20–5000 characters). Opening atomically records the case, sets job and payment to `disputed`, writes an audit and notifies both participants. The job cannot be completed by a participant while disputed.

There is one active case per job. Concurrent identical retries by the opener return that case; a different submission conflicts. Completed work cannot be disputed through this endpoint. Staff must handle transfer reversals and other financial exceptions through operational reconciliation, which remains unfinished.

`GET /disputes` lists only the signed-in client's/provider's cases and supports `limit`, `offset` and `status`. `GET /disputes/{id}` and `/disputes/{id}/decisions` require participation; unrelated IDs return 404. Decision history includes the deciding actor, reason, outcome, refund amount and timestamp.

## Admin dashboard workflow

Active admin/finance staff use `GET /admin/disputes` and `/admin/disputes/{id}` to read cases. List filters accept `open`, `under_review`, `resolved_for_client`, `resolved_for_provider` and `closed`. This stage creates open cases and final decisions; no separate assignment or under-review action is provided.

Submit `POST /admin/disputes/{id}/decision` with:

- `decision`: `resolved_for_client` or `resolved_for_provider`.
- `reason`: 3–2000 characters explaining the judgment.
- `refundAmountMinor`: optional. A client outcome refunds the full original payment; if supplied, this value must match it. A provider outcome accepts only omission or zero. Partial settlements are unsupported.

A client outcome cancels the job, restores the collected payment to `funded` and queues one full refund. A provider outcome completes the job, queues one payout and sets payment to `release_pending`. Staff approval supplies the payout authorization instead of client confirmation. The existing [settlement worker](backend-settlements.md) checks the account and provider before transfer, and verifies Paystack evidence before marking money released/refunded. The decision endpoint does not make an external money request.

Resolution requires verified Paystack collection evidence and no prior payout or refund reservation. Cases with conflicting financial records fail with `FINANCIAL_REVIEW_REQUIRED`. Identical retries by the original deciding actor return the existing decision; conflicting or repeated decisions from another actor return 409. There is no decision reversal endpoint.

The final decision, financial reservation, job/payment transitions, audit and participant notifications commit together. Notification persistence failure rolls back the outcome. Socket.IO `notification.new` events publish after commit; reload REST history after reconnect. Permissions come from current database roles, so revocation takes effect immediately.

## Remaining work

Reconciliation, chargeback/reversal resolution, staff assignment, attachment submission and partial settlements remain unfinished. The admin dashboard UI still needs to call these endpoints. Review creation and participant job review lookup are implemented; see [review integration](backend-contact-and-reviews.md).
