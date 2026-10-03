# Frontend requests, quotes and jobs

The frontend connects the existing participant-only hiring and collaboration endpoints. Admin work remains deferred.

## Requests and quotes

`/requests/new?providerId=<uuid>` creates a request for an active public service. `/requests` lists client requests, `/provider/requests` lists incoming provider requests, and `/requests/{id}` opens a real request. The provider detail alias remains available at `/provider/requests/{id}`. Notifications now resolve to request detail rather than treating a request ID as a provider ID.

Requests submit the backend's provider/service IDs, a meaningful description, optional integer NGN budgets, optional future date/time and location. Frontend forms convert browser-local date/time to ISO timestamps and NGN to minor units. Duplicate submissions are disabled while pending; failed network writes are not automatically repeated.

Request detail shows its actual status, dates, brief, budgets and quotes. The client may withdraw an open request, and the assigned provider may decline it or send quotes. Closing actions require a reason. Providers can send replacement quotes while the request remains open.

Quotes submit positive integer minor-unit amounts, 1–50 deliverables, optional notes/delivery time and required future expiry. Both participants can view quotes. The client may accept or decline a sent unexpired quote; the provider may cancel it. Expiry disables client actions while the page remains open. Backend action endpoints remain authoritative.

Acceptance opens `/jobs/{id}` and displays `awaiting_payment`. It does not collect money, mark the job funded or show a fictitious protected-payment receipt. Backend retries of the same acceptance return the same job.

Request/job lists and request quote lists expose previous/next pagination. Participant views filter the backend-owned collection according to the authenticated account; IDs supplied by the browser do not change backend authorization. Backend 404/403/conflict responses are shown instead of substituted records.

## Jobs and milestones

Job pages show canonical backend statuses, the agreed amount, original request and quote scope. They do not depend on unfinished transaction or conversation mappings. The provider can start scheduled work and submit completed work; the client can confirm delivery. Confirmation queues payout through the existing backend and does not imply that a transfer has succeeded. Either participant may cancel an unpaid job with a reason; collected payments require the separate refund workflow.

Both participants see milestones. Providers can add titles, descriptions and optional future deadlines while the job is editable, then advance pending milestones to in-progress and completed after work starts. Backend checks prevent submitting a job with incomplete milestones. Completed, cancelled and disputed jobs expose no milestone mutation controls.

Requests, quotes, jobs and milestones refresh periodically through TanStack Query. The provider dashboard uses the connected request/job lists and links to real onboarding/review status rather than fetching an unpublished profile from the public catalog or fabricating reputation metrics.

## Validation and remaining work

Run frontend typecheck, lint, production build, `npm run test:money-input`, and both HTTP integration modes. Disposable contract fixtures use separate client/provider/outsider accounts and exercise payload mapping, participant permissions, acceptance retries, awaiting-payment status, blocked premature starts, milestone gating, client completion, closed requests, cancellation conflicts and unrelated-user rejection. Payment verification in these fixtures is simulated; no gateway, email, upload or project database writes occur. Browser interactions and actual provider delivery remain deployment checks.

Paystack checkout and payment/earnings screens are now connected; see [frontend payments](frontend-payments.md). Socket.IO messaging and job conversation links are now connected; see [frontend messaging](frontend-messaging.md). Completed-job reviews are connected; see [frontend reviews](frontend-reviews.md). Participant disputes and account/provider settings are connected; see [disputes](frontend-disputes.md) and [settings](frontend-settings.md). Admin frontend remains deferred. The job workflow uses actual backend states rather than the removed placeholder job/request/quote types.
