# Student verification implementation (F3)

Student verification now supports automatic university email confirmation and admin/reviewer document review. The backend is implemented; the frontend developer still needs to connect the student forms and admin dashboard to these APIs. All paths below are relative to `/api/v1`. Swagger and `konet-backend/openapi.json` describe the request fields and responses.

## What admins actually review

University email verification does **not** enter the manual review queue. A student requests a six-digit code at an approved university email address, then confirms it. The backend verifies ownership and updates their student status automatically.

A student without usable university email uploads a student card or document and submits it. It appears immediately in `GET /admin/student-verifications?status=pending`. An admin or reviewer opens the private evidence and records `verified`, `rejected`, or `requires_more_information`, with a reason. The student sees that reason in their verification history. The backend writes a notification record and an audit event in the same transaction as the decision. Notification reads already exist; real-time notification delivery and email notifications for manual decisions are outside this feature.

Reviewers use the admin dashboard and require an `admin` or `reviewer` role. The first administrator is bootstrapped using the [trusted staff setup command](backend-universities.md); administrators then grant reviewer roles through the API. Support, finance, and ordinary student accounts cannot use the review queue. Reviewers cannot decide their own submission. There is no review schedule or automatic approval timer: the team should assign someone to check the pending queue regularly. Submission age (`submittedAt`) is available for displaying waiting time.

## Automatic email flow

1. Fetch `GET /universities/{id}/verification-methods` for available methods and approved domains.
2. Send `POST /me/student-verification/email-challenges` with `{ "email": "student@approved-university-domain.edu" }`. Response `202` contains `challengeId`, `expiresAt`, `delivery: "email"`, and `resendAfter`.
3. Send `POST /me/student-verification/email-challenges/confirm` with `{ "challengeId": "<uuid>", "code": "<six digits>" }`. Keep the code as a string to preserve leading zeroes. Success is `200` with the updated verification record.
4. Refresh `GET /auth/me` and invalidate the frontend verification-history query.

A code expires after 10 minutes and can succeed once. Five wrong attempts exhaust it; failed attempt counts commit even when the API returns an error. Resends invalidate earlier codes and cancel queued older messages. Allow 60 seconds between requests and at most three per hour per account. HTTP throttling provides an additional limit. The code is stored as a keyed hash; messages are encrypted in the existing Resend outbox and never returned to the client.

The email must have an exact approved domain for the student's selected university; approving a parent domain does not automatically approve every subdomain. University and campus must be active. Eligibility is checked again at confirmation, including changes to the selected university/campus or domain approval. One university email can verify one account, enforced by a database unique index even for simultaneous confirmations.

A pending document review blocks email verification. An already verified student cannot submit again. `POST /me/student-verification` with `method: "university_email"` returns `400 EMAIL_CHALLENGE_REQUIRED`; it cannot bypass the ownership challenge.

## Private upload and document flow

1. Send `POST /uploads/presign` with `purpose: "student_evidence"`, `fileName`, `contentType`, and `sizeBytes`. JPEG, PNG, and PDF are accepted, up to 10 MiB. This feature implements student evidence only; other upload purposes return `501 UPLOAD_PURPOSE_NOT_IMPLEMENTED`.
2. Upload to the returned `uploadUrl` using **POST multipart/form-data**. Add **every returned `fields` entry**, then add the binary under `file`. Do not manually set the multipart Content-Type; the browser supplies the boundary. The API secret never leaves the backend.
3. Call `POST /uploads/{id}/complete` (`202`). The backend reads Cloudinary metadata and malware moderation. Repeat this endpoint while `status` is `scanning`; `GET /uploads/{id}` reads the last recorded status and does not poll Cloudinary. Missing moderation never counts as a clean scan.
4. When `status` is `ready`, send `POST /me/student-verification` with `method: "student_id"`, `studentNumber`, and `evidenceObjectKey: upload.objectKey`. `manual_document` also requires ready evidence but does not require a student number.
5. Show pending status and the history from `GET /me/student-verification`. A student can resubmit new evidence after rejection or a request for more information. At most three submissions per day, one pending document submission, and five retained unused uploads per account are allowed.

Example browser upload:

```ts
const form = new FormData();
for (const [name, value] of Object.entries(ticket.fields)) {
  form.append(name, String(value));
}
form.append("file", file);
const response = await fetch(ticket.uploadUrl, { method: "POST", body: form });
if (!response.ok) throw new Error("Document upload failed");
// Then call Konet POST /uploads/{ticket.upload.id}/complete.
```

Cloudinary assets use `type=authenticated`, fixed opaque object keys, and `overwrite=false`. The backend checks provider metadata against the declared content type, expected size, resource type, and key. It accepts only explicit `perception_point: approved` moderation as ready. A mismatch or rejected scan marks the upload rejected. The student number is stored as a keyed hash scoped to the university; raw numbers and evidence keys are withheld from verification responses.

Unattached files can be removed using `DELETE /uploads/{id}` (`204`). Submitted evidence follows the retention policy and cannot be independently deleted by the student. Evidence is not exposed by a public document URL.

## Admin dashboard API

| Action | Endpoint | Result |
| --- | --- | --- |
| Pending queue | `GET /admin/student-verifications?status=pending&limit=20&offset=0` | Array of document submissions, newest first |
| Other decisions | Same endpoint with `status=verified`, `rejected`, or `requires_more_information` | Filtered document history |
| Submission detail | `GET /admin/student-verifications/{id}` | Safe metadata, `uploadId`, decision reason |
| Open evidence | `GET /uploads/{uploadId}/download` | Private signed download valid for five minutes |
| Decision | `POST /admin/student-verifications/{id}/decision` | Decision record (`201`) |
| Student history | `GET /me/student-verification` | Own history with reasons and upload IDs |

Decision request:

```json
{ "decision": "verified", "reason": "Student card and university details checked." }
```

Only the owner can see unattached evidence. An admin/reviewer can download attached student evidence; every authorized download is audited. Downloads require retained, ready evidence. Concurrent decisions produce exactly one decision; subsequent attempts return `409 VERIFICATION_ALREADY_DECIDED`. Approval checks the student's active current university/campus against the submission snapshot and requires available scanned evidence. If the context changed or the evidence expired, request new information instead. Existing legacy document submissions without tracked scanned evidence can be rejected or returned for resubmission, but cannot be approved.

## Configuration, migration, and retention

Apply migration `0003_big_champions.sql` with the deployment's normal migration procedure before starting this version. It creates upload, challenge, and decision records; adds university/campus snapshots and verified email; and enforces one pending submission per user. For legacy duplicate pending submissions it retains the newest pending record and marks older records as requiring more information. It does not automatically trust old evidence URLs or mark existing students verified.

Set the following environment variables in the server environment:

```dotenv
CLOUDINARY_CLOUD_NAME=<cloud name>
CLOUDINARY_API_KEY=<API key>
CLOUDINARY_API_SECRET=<API secret>
CLOUDINARY_MALWARE_SCAN_ENABLED=true
EVIDENCE_RETENTION_DAYS=30
```

All three credentials must be provided together. Activate Cloudinary's **Perception Point malware moderation add-on** before enabling the scan flag; check availability and pricing for the account. Setting a flag alone cannot pass a scan: the backend still checks the provider's actual moderation result. The implementation does not subscribe your account to an add-on. See Cloudinary's [malware add-on documentation](https://cloudinary.com/documentation/perception_point_malware_detection_addon), [moderation documentation](https://cloudinary.com/documentation/moderate_assets), and [authenticated access documentation](https://cloudinary.com/documentation/control_access_to_media).

Without storage credentials or the scan flag, private upload requests return `503` with `STORAGE_NOT_CONFIGURED` or `EVIDENCE_SCANNING_NOT_CONFIGURED`. Provider lookup failures return `503 STORAGE_UNAVAILABLE`, while an asset not uploaded yet returns `409 UPLOAD_NOT_FOUND_AT_PROVIDER`. Do not treat those errors as successful uploads.

Email confirmation uses the existing `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_OUTBOX_KEY` settings from the [account guide](backend-accounts.md). Without them, requesting a code returns `503 EMAIL_DELIVERY_NOT_CONFIGURED`. The JWT refresh secret is also used with purpose prefixes for keyed verification hashes; rotating it invalidates outstanding verification codes.

The Konet ticket completion window is 10 minutes. Cloudinary's signed upload timestamp validity is independently controlled by Cloudinary; deletion of unused evidence therefore waits at least one hour from ticket creation to prevent late re-creation through an old signature. Unattached uploads otherwise expire after one day. Attached evidence expires after `EVIDENCE_RETENTION_DAYS` from submission, then receives the same retention period again when a reviewer decides it. A worker runs every minute while the API is running, deleting up to ten expired assets per pass, retaining metadata and audit records, and retrying provider failures. Downloads stop immediately when retention expires. A review that exceeds retention must request fresh evidence. The worker is intentionally disabled in tests.

No real Cloudinary uploads or Resend deliveries were performed during implementation; provider adapters are mocked in tests. Production credentials, account add-on activation, migrations, and the frontend dashboard integration remain deployment/team tasks.
