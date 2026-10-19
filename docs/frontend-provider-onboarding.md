# Provider onboarding frontend

The five `/provider/onboarding` steps now use canonical backend records. The provider service list/editor and portfolio workspace also use owner data, including drafts. Admin dashboard work remains deferred.

## Flow

1. A verified student creates or updates a provider profile with a professional title, bio and response time. The optional public cover image is selected as a file and uploaded to Cloudinary; the verified Cloudinary URL is saved with the profile. Existing values load from the backend. Changing substantive approved profile content requires another review.
2. Add a service using an active category, one of the backend pricing types and an NGN price when required. Prices are converted to minor units. Services are saved as drafts; service editing uses owner records rather than public catalog reads.
3. Optionally create, edit or delete portfolio metadata: project/case-study/certificate descriptions, public HTTPS image URLs or external links. The old placeholder file input is removed. Public portfolio upload tickets are not implemented by the backend. Published profiles display linked and text-only entries as well as images.
4. Upload identity and work evidence using the shared private Cloudinary uploader with `purpose: provider_evidence`. The backend validates private object metadata before attachment; malware scanning is currently disabled. Identity and work are required; CAC is optional. Each dimension shows its returned status, revision and reviewer reason. Pending and verified dimensions do not offer duplicate submission controls. Rejected dimensions and requests for more information allow replacement evidence.
5. The preview shows the real records and eligibility hints. Submit the overall profile for admin review after saving a service and attaching mandatory evidence. Pending review freezes canonical editing. Onboarding state refreshes every 15 seconds while these screens are open.
6. An approved profile remains draft until its owner publishes it. Publishing does not activate services. The preview and service workspace expose separate activation and pause actions for services. Content changes that invalidate approval are reflected from the backend.

Action endpoints revalidate permissions and requirements; frontend hints cannot approve or publish a provider. Errors are rendered instead of simulated success. Suspension prevents editing/publication controls. Student verification is checked by the existing provider layout and backend.

The shared API registry maps the onboarding snapshot, public categories, profile creation/update/submission/publication, service creation/update, portfolio creation/update/deletion and evidence attachment. The draft-step command also maps legacy frontend `service` and `verification` names to backend `services` and `evidence`, with typed JSON values. Form progression saves canonical records; partial unsaved inputs and current upload state remain local to the open page.

## Validation

Frontend typecheck, lint, production build, private-upload tests, and production/development HTTP journeys cover the changes. Contract fixtures exercise student eligibility, draft records, minor-unit prices, step-name mapping, unconfirmed evidence rejection, mandatory dimensions with optional CAC, pending-review edit protection, correction/revision resubmission, separate approval/publication/service activation, portfolio links on a published profile, and approval invalidation.

Tests use a disposable local HTTP backend and mocked uploads. They do not perform real admin decisions, send email, upload to Cloudinary or exercise browser interactions. Real uploads require Cloudinary credentials; documents are not malware-scanned.

Request/quote/job pages, payments and earnings, Socket.IO messaging, and provider settings are connected. See [frontend settings](frontend-settings.md) for owner-only profile reads, availability and pause/publication controls. Admin UI remains deferred. The published profile no longer depends on an unfinished conversation query.
