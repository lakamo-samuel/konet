# Contact form and job reviews

## Job review lookup

`GET /jobs/{id}/review` requires a live Bearer session and participation as the job client or provider. It returns the single stored review. A job without a review returns 404 `REVIEW_NOT_FOUND`; an unrelated or missing job returns 404 `JOB_NOT_FOUND`. The route validates UUIDs.

Existing `POST /reviews` accepts `jobId`, `rating` (1–5) and `comment` (at least five characters). Only the client of a completed job may create it. The database allows one review per job. Review creation does not require payout to have completed. Frontend job screens should handle the no-review 404 by showing the review form to an eligible client.

## Public contact form

Migration `0010_sticky_daredevil.sql` adds durable contact records and permits anonymous encrypted email outbox entries.

`POST /contact` is public and accepts `email` (valid email, max 255 characters), `topic` (3–100) and `message` (10–5000). Meaningful trimmed text is required. It returns HTTP 202 with `{message}` after the contact record and encrypted email queue commit together. A queue failure rolls back acceptance.

Configure the existing Resend settings (`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_OUTBOX_KEY`) and set the new `SUPPORT_EMAIL` placeholder in `.env` to your monitored support inbox. Missing configuration returns 503 `EMAIL_DELIVERY_NOT_CONFIGURED` or `SUPPORT_EMAIL_NOT_CONFIGURED`. The asynchronous worker sends a fixed-subject, plain-text message to this trusted inbox. The submitted address is labelled unverified in the email body. User content cannot change sender, recipient or subject, and no automatic email is sent to the visitor.

The existing delivery worker retries transient failures with the same idempotency key, clears encrypted payloads after sending and expires contact delivery after 24 hours. A 202 response confirms persistence/queueing, not successful email delivery. Tests use mocked delivery and never send real email.

Limits are three submissions per IP/minute and three per submitted email/hour. The per-email limit uses a database transaction lock so concurrent submissions cannot bypass it. Input is stored as plain text; frontend/support tooling must escape it when rendering HTML.

Support staff receive messages in the configured mailbox. Contact inbox management within the admin dashboard is not supplied by this endpoint. Stored contact records remain private; there is no public contact-history endpoint.
