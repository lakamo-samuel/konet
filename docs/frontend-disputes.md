# Participant disputes

`/disputes` lists the current user's client and provider cases, with status filters and 20-record pagination. `/disputes/[id]` shows participant-only case details, read-only decision history and actual payment/refund/payout status. Job pages and the job list link to disputes; dispute notifications open the matching case.

Eligible funded jobs link to `/jobs/[jobId]/dispute`. The form sends only a trimmed reason (3–100 characters) and description (20–5000 characters). Author, status and financial amounts come from the backend. Backend checks remain authoritative if job state changes while the form is open. Identical retries by the opener return the case. A conflicting existing case directs the user to the dispute list rather than claiming another case was created. Draft text remains available on failures.

Opening freezes job completion and provider payout pending an authorized decision. Resolution is displayed as a decision, not as a completed refund or transfer; the payment panel reads actual financial status. Neither participant has staff decision controls. Lists and cases can be refreshed manually; existing Socket.IO notification invalidation refreshes relevant cached queries. No new message polling is introduced.

Attachment submissions, staff assignment and partial settlements remain unsupported by the backend and are not simulated. Admin dashboard integration stays deferred. No migration, credentials or new backend routes are needed.
