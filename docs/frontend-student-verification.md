# Student verification frontend

The `/verify-student` and `/verification` screens now share the real verification flow. `/profile/verification` redirects to `/verification`. Admin dashboard work remains paused.

## Student flow

The screen reads the authenticated account, its university's available methods and approved email domains, and the student's verification history. Students verify the university/campus already selected on their account.

University email requests queue a Resend code through the backend. The UI shows the returned resend cooldown and expiry, preserves leading zeroes in the six-digit confirmation code, and refreshes the account and history after confirmation. Only the backend's verified status displays success. Pending email confirmation is distinguished from pending document review.

Student ID verification requires a matriculation number and a document. Other student documents do not require a matriculation number. JPEG, PNG and PDF files up to 10 MiB are accepted. The shared upload helper requests a signed Cloudinary ticket, posts every returned field with the binary file, and sends no Konet credentials to Cloudinary. Upload destinations must use HTTPS on `api.cloudinary.com`.

After Cloudinary accepts the file, the frontend asks the backend to verify its private ownership and file metadata. A valid file is ready for submission immediately; a file with mismatched type or size is rejected. Malware scanning is currently disabled. Unsubmitted uploads can be removed. Switching methods preserves the selected upload while the page remains open.

Document submission displays pending admin review. The history refreshes every 15 seconds while the page is open, includes decision timestamps and reviewer feedback, and refreshes current account eligibility when the history changes. Rejection or a request for more information allows fresh evidence; pending document review blocks further verification forms. Verified accounts see the confirmed status and history.

The file and email-challenge form state lasts for the current page session. Reloading may require a new code or fresh upload; the backend's resend limits and retention policy still apply. Failed uploads remain removable when a ticket was issued.

## Shared API operations

| Frontend operation | Backend endpoint |
| --- | --- |
| `verificationMethods` | `GET /universities/{id}/verification-methods` |
| `studentVerifications` | `GET /me/student-verification` |
| `requestVerificationCode` | `POST /me/student-verification/email-challenges` |
| `confirmVerificationCode` | `POST /me/student-verification/email-challenges/confirm` |
| `createUpload` | `POST /uploads/presign` |
| `upload` | `GET /uploads/{id}` |
| `completeUpload` | `POST /uploads/{id}/complete` |
| `deleteUpload` | `DELETE /uploads/{id}` |
| `submitVerification` | `POST /me/student-verification` |

Paths are relative to `/api/v1`. Typed contracts, input checks and endpoint mappings stay in the central data layer. Existing development bearer and production cookie transports are preserved.

## Configuration and validation

The API needs active university/campus records and approved university email domains. Real delivery requires configured Resend. Private evidence requires Cloudinary credentials and is checked for file metadata, but it is not malware-scanned; staff review documents after submission. See [the backend verification guide](backend-verification.md).

Run frontend typecheck, lint, build, `npm run test:uploads`, `npm run test:integration`, and `npm run test:integration:dev`. HTTP tests use a disposable contract fixture and cover leading-zero and expired codes, failure/configuration responses, upload confirmation, pending review, feedback, resubmission and deletion. Upload-helper tests check multipart fields, file limits, destination validation and credential isolation. These checks do not send real emails, upload to Cloudinary or exercise browser interactions; real provider delivery remains a deployment check.
