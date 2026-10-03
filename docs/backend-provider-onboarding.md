# Provider onboarding and approval (F4)

The backend now implements provider drafts, onboarding form persistence, services created during onboarding, portfolio metadata, private provider evidence, reviewer decisions, and controlled publication. Identity and work checks are both required, as selected by the team; CAC is optional. All paths below are relative to `/api/v1`. The [provider onboarding frontend](frontend-provider-onboarding.md) is connected. Admin dashboard integration remains deferred.

## Student email verification clarification

Resend is the email delivery provider, not the authority that approves students. Konet generates a six-digit code, stores its keyed hash, and queues an encrypted email through Resend. The student enters the code; Konet checks its ownership, expiry, attempt limit, and approved university domain before setting student status to verified. University email confirmation needs no admin decision. Student ID/document submissions use the manual admin/reviewer flow described in the [student verification guide](backend-verification.md).

## Provider flow

1. Complete student verification, then create a provider draft with `POST /me/provider-profile`. Required fields are `professionalTitle` (at least three characters) and `bio` (at least forty). Optional fields are `responseTimeMinutes` and a public HTTPS `coverImageUrl`. Profile creation and identity/work/CAC records are one transaction.
2. Create at least one service using `POST /services`. It now works for draft providers and always creates a **draft** service. Select an active category; priced services require a positive `priceMinor` in NGN. A custom-quote service can omit the price. Draft services are not publicly visible.
3. Add optional portfolio entries through `/me/portfolio`. The API persists project/case-study/certificate descriptions and public links or image URLs. Images require `assetUrl`; external links require `externalUrl`. URLs must use HTTPS. Private verification evidence must not be used as a cover or portfolio asset. Dedicated public portfolio upload tickets remain outside this feature.
4. Upload identity and work documents using `POST /uploads/presign` with `purpose: "provider_evidence"`. Use the same authenticated Cloudinary multipart POST and completion/scanning flow as student evidence. Only your own ready, retained, unused provider evidence can be attached.
5. Attach each file with `POST /me/provider-verifications`: `{ "dimension": "identity", "evidenceObjectKey": "<upload.objectKey>" }`, and similarly for `work`. CAC can be submitted separately but is not required. Responses contain `id`, `revision`, `uploadId`, status and reason; private storage keys are withheld from verification reads.
6. Submit the overall profile using `POST /me/provider-profile/submit` (`202`). Both mandatory dimensions must be pending or verified and a non-archived service must exist in an active category. The overall profile enters `status: "pending_verification"` and `reviewStatus: "pending"`.
7. An admin/reviewer checks identity and work evidence, then approves the overall profile. Overall approval grants `reviewStatus: "approved"` and `approvedAt`, while leaving publishing `status: "draft"`.
8. The provider calls `POST /me/provider-profile/publish` (`200`) to become active. Then activate individual services with `PATCH /me/services/{id}` and `{ "status": "active" }`. Publishing cannot approve an account or automatically activate all its services.

`GET /me/provider-profile`, `/me/provider-verifications`, `/me/services`, and `/me/portfolio` return the owner's records. `GET /me/provider-onboarding` combines them with saved step drafts, requirements, and `canSubmit`/`canPublish` hints. Before creating a profile it returns `profile: null` and empty collections. Action endpoints always revalidate eligibility; hints do not grant permissions.

## Form drafts and canonical records

`PATCH /me/provider-onboarding/steps/{step}` accepts `{ "values": { ... } }`, replaces that step's saved form draft, and returns the combined onboarding response. Valid backend step names are **profile**, **services**, **portfolio**, **evidence**, and **preview**. The current frontend uses `service` and `verification` in places; its adapter must map these to `services` and `evidence`.

Saved form drafts are separate from actual profile, service, portfolio and evidence records. Use the dedicated create/update endpoints to create canonical records before submitting for review. Saving `ready: true` does not satisfy a requirement, approve a provider, or publish anything.

| Step | Allowed values |
| --- | --- |
| profile | Partial `ProviderUpdateInput`: professionalTitle, bio, responseTimeMinutes, coverImageUrl, availability |
| services | Partial service form: categoryId, title, description, pricingType, priceMinor, currency |
| portfolio | Partial `PortfolioUpdateInput`: type, title, description, assetUrl, externalUrl |
| evidence | Partial `ProviderEvidenceInput`: dimension, evidenceObjectKey |
| preview | Optional boolean `ready` only |

Unknown fields, null values, status/approval injection and drafts above 16 KB are rejected. Partial drafts may omit fields, but present fields must pass the corresponding validation. File names or binaries are not evidence: attach an actual scanned upload through `/me/provider-verifications`.

## Admin dashboard review

All review routes require an active `admin` or `reviewer` role. Reviewers can see the applicant's name, university/campus and account/student status in detail responses without using the administrator-only user-management endpoints. They cannot review their own profile or evidence.

| Action | Endpoint |
| --- | --- |
| Evidence queue | `GET /admin/provider-verifications?status=pending&limit=20&offset=0` |
| Evidence detail/history | `GET /admin/provider-verifications/{id}` |
| Open evidence | `GET /uploads/{uploadId}/download` |
| Evidence decision | `POST /admin/provider-verifications/{id}/decision` |
| Overall profile queue | `GET /admin/providers?status=pending&limit=20&offset=0` |
| Overall profile detail/history | `GET /admin/providers/{id}` |
| Overall decision | `POST /admin/providers/{id}/decision` |

Evidence decision example:

```json
{ "revision": 1, "decision": "verified", "reason": "Identity document checked against the applicant." }
```

Evidence decisions allow `verified`, `rejected`, or `requires_more_information`. Use the current verification's `revision` from detail. Overall decisions allow `active`, `rejected`, or `requires_more_information`; use the current profile's `reviewRevision` as request `revision`. The retained overall decision name **active** means **grant staff approval**, then the owner publishes separately:

```json
{ "revision": 1, "decision": "active", "reason": "Identity and work evidence approved; profile checked." }
```

Overall approval requires both identity and work already verified, a currently verified active student at an active university/campus, and a service in an active category. Review queues accept status filters: overall queue uses `reviewStatus` (`pending`, `approved`, `rejected`, `requires_more_information`, `not_submitted`), while the evidence queue uses verification status (`pending`, `verified`, `rejected`, `requires_more_information`, `not_submitted`). These filters describe review state, not profile publication state.

Pending overall review freezes canonical profile, service, portfolio and new evidence edits. Rejecting a mandatory evidence submission during overall review automatically returns the profile to draft with `requires_more_information`, records an overall decision, and allows corrections. The student receives the reason as a notification record and in owner responses. A rejected evidence dimension can be resubmitted with a new scanned upload; its revision increments, and earlier submissions/decisions remain in history. One pending submission per dimension and three submissions per dimension per day are allowed.

Required revision numbers prevent a reviewer form from an older submission approving a newer attempt. Concurrent decisions produce exactly one decision; stale or repeated decisions return `409`. Every decision, evidence download, submission, publication and canonical mutation is audited. Notifications and decisions commit in the same transaction as the state change. Live email notifications for manual decisions are not part of this feature.

## Publication and later changes

Only published, staff-approved providers belonging to active verified student accounts appear in public provider reads. Public services also require an active approved provider. The same gate protects direct service detail reads, so pausing a provider hides services as well as the provider page. Public provider service, portfolio and review subroutes are now implemented.

`PATCH /me/provider-profile/status` accepts `active` or `paused` for an approved provider. Reactivation rechecks eligibility and requirements; suspended providers cannot reactivate themselves. Availability and response-time edits preserve approval. Changing title, bio, cover, or portfolio content invalidates overall approval and returns the profile to draft; the provider must resubmit and receive approval before republishing. Previously approved identity/work dimensions remain valid. Service creation does not activate services, and service activation requires a published approved provider.

Evidence uses the existing Cloudinary malware moderation and retention configuration. Uploaded provider evidence is private and cannot be independently deleted after submission. Approved dimension decisions remain valid after evidence is purged by retention; unreviewed expired evidence cannot be approved and needs a reviewer to request resubmission. Optional CAC rejection does not fail identity/work approval. Public verification badges expose dimension statuses, not private documents or review reasons.

## Migration and deployment

Apply `0004_unknown_barracuda.sql` after the student-verification migration. It adds profile review fields, evidence revisions/submissions, immutable decision history, saved form drafts and upload associations. **Legacy active/paused/pending provider flags have no documented review history in the old implementation:** the migration returns those profiles to draft, records an audit event, and asks legacy pending/verified dimensions for new scanned evidence. Suspended profiles remain suspended. Check these changes with the team before applying the migration to an environment with existing provider accounts; migrations 0000–0004 were applied to the configured local Docker database on 2026-10-01; other deployments still need their normal migration procedure.

No extra external service is required beyond the configured Cloudinary integration. Identity and work are required by the implementation; CAC is optional. Live uploads still need credentials and Cloudinary malware moderation activated. Provider portfolio upload tickets remain unimplemented; use metadata/public links for now. Category management and public search filters are implemented in the [catalog feature](backend-catalog.md).

Swagger and the offline OpenAPI snapshot include these routes, required decision revision fields, success schemas and errors. The tests use disposable local PostgreSQL databases, a real Nest HTTP app and mocked Cloudinary; no real uploads or emails are sent.

## Validation

The full backend regression suite passes, including provider workflow and migration upgrade tests. Tests cover atomic duplicate creation, student gating, draft visibility, mandatory evidence, separate approval/publication, pausing, ownership, expired evidence, self-review, stale revisions, concurrent decisions, correction/resubmission history, approval invalidation, typed form drafts, private portfolio URL rejection, and legacy migration behavior. Typecheck, lint, build, and offline OpenAPI export also pass.
