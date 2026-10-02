# Hiring integration guide

Hiring now supports private service requests, provider quotes, and transactional quote acceptance. Routes are under `/api/v1` and require a live bearer session. Swagger and `konet-backend/openapi.json` describe the input and response schemas.

| Route | Behavior |
| --- | --- |
| `POST /requests` | Verified client requests an active service from an approved, published provider. |
| `GET /requests`, `GET /requests/{id}` | Participant-owned request list and detail. |
| `POST /requests/{id}/withdraw` | Client withdraws an open request, with a reason. |
| `POST /requests/{id}/decline` | Assigned provider declines an open request, with a reason. |
| `GET /requests/{id}/quotes` | Participant-owned quotes for the request. |
| `POST /quotes` | Assigned provider sends a quote with price, scope, and expiry. |
| `GET /quotes`, `GET /quotes/{id}` | Participant-owned quote list and detail. |
| `POST /quotes/{id}/decline` | Client declines a quote, with a reason. |
| `POST /quotes/{id}/cancel` | Provider cancels a quote, with a reason. |
| `POST /quotes/{id}/accept` | Client accepts a quote and receives the job, HTTP 201. |
| `GET /requests/{id}/conversation` | Returns the conversation created by acceptance; 404 before it exists. |

## Frontend flow and validation

Create a request with `providerId`, `serviceId`, and a description of at least 20 non-whitespace characters (maximum 10,000). Optional minimum/maximum budgets are integer NGN kobo; minimum must not exceed maximum. Optional `requestedAt` must be in the future. The service must belong to that provider and have a visible active category. Both accounts must be active and student-verified; the provider must be approved, published, and available. Self-hiring is rejected.

The assigned provider creates a quote with `requestId`, positive integer `amountMinor`, `scope`, and future `expiresAt`. Optional `deliveryAt` must also be in the future. Scope contains 1–50 nonblank strings, each at most 2,000 characters; notes have a 10,000-character limit. Monetary inputs fit PostgreSQL's integer range (maximum 2,147,483,647). Currency is NGN and cannot be supplied through these inputs. A quote is a proposal; request budget fields do not enforce its price.

Lists accept `limit` (default 20, maximum 100), `offset`, and a validated optional `status`. Historical reads remain available to the participants. Unrelated users receive 404; a participant attempting the other participant's action receives 403. Malformed inputs receive 400; invalid business inputs receive 422; conflicting states receive 409.

Requests begin `pending`, become `quoted` when a quote is sent, and become `converted_to_job` on acceptance. Withdrawal or provider decline closes the request and cancels outstanding quotes. A provider may send a replacement after a quote is cancelled or declined while the request remains open. Sent quotes whose expiry has passed appear as `expired` in reads and filters; this is derived from the timestamp rather than a background database status update.

Withdrawal, request decline, quote decline, and quote cancellation require a reason and support retries of the same completed action. Closed requests cannot receive new quotes or be accepted.

## Acceptance guarantees

Acceptance locks the request and quote and rechecks participants, provider approval/publication/availability, active service/category, matching NGN currency, expiry, and delivery date. The transaction accepts one quote, declines outstanding competing quotes, closes the request, creates one job in `awaiting_payment`, one `pending` payment, one conversation with both participants, and audit/notification records. A failure rolls back the entire operation.

Repeated or simultaneous acceptance of the same quote returns the original job with HTTP 201. Acceptance of another quote for the same request returns 409. A successful retry still returns the original job if the provider subsequently pauses publication. Database uniqueness constraints reinforce these guarantees.

Request creation and quote creation do not yet accept idempotency keys: a repeated POST can create another record. Prevent duplicate submissions in those frontend forms. Acceptance itself is safe to retry.

No funds are collected or released by acceptance. The current fee policy remains zero until the payment/fee feature is implemented. Notifications are stored in the application; this feature does not send hiring emails.

## Database and verification

This feature uses the existing schema and needs no additional migration. The project database was migrated through migration 0004 during the preceding feature. Normal deployment still requires `npm run db:migrate`.

Integration tests use a separate disposable PostgreSQL database. They cover participant access, validation, request/quote closure, expiry, provider/category/verification changes, concurrent acceptance and withdrawal, unsupported currency, and rollback when payment creation fails. Payment gateway integration and the remaining job workspace functionality are separate features.
