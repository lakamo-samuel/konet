# Konet API

Production-oriented NestJS modular monolith for Konet's student service marketplace. PostgreSQL and Drizzle are the source of truth; money is stored in integer minor units. Redis and BullMQ are intentionally omitted until a real queue, distributed socket, or caching requirement exists.

## Local setup

1. Copy `.env.example` to `.env` and replace both JWT secrets.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Run `npm ci`, `npm run db:migrate`, and `npm run db:seed`.
4. Start the API with `npm run start:dev`.

Set `KONET_API_URL=http://localhost:4000/api/v1` in the Next.js frontend environment to use API-backed university, provider, discovery, and service repositories.

The REST API is rooted at `/api/v1`; Swagger is at `/api/docs`; health is at `/api/v1/health`.

## Frontend integration contracts

All planned routes are registered and documented: 151 operations, including 7 contract-only endpoints. Swagger specifies authentication, required and optional fields, validation, success schemas, and errors. New endpoints return `501 ENDPOINT_NOT_IMPLEMENTED` until their services are implemented; Paystack checkout returns 503 until its secret key is configured. Documented success schemas support frontend client generation and mocks, rather than successful live calls to unfinished routes.

See the [API handoff and full route inventory](../docs/backend-api-contract.md). Share [openapi.json](openapi.json) with the frontend developer, or fetch `/api/docs/json`. Run `npm run docs:export` to regenerate the offline snapshot without a database or running API.

## Security and domain boundaries

Access tokens are short-lived. Refresh tokens are held in an HttpOnly cookie, hashed in PostgreSQL, rotated atomically on every refresh, and revocable. Access tokens are bound to a live session; logout and password changes revoke access immediately. Reusing a rotated refresh token revokes its session family. Protected resources validate the current user against request, provider, job, conversation, notification, review, and dispute ownership. Quote acceptance is retry-safe and creates the job, payment, and participant conversation in one database transaction, reinforced with unique constraints. See the [hiring integration guide](../docs/backend-hiring.md).

Provider publishing requires a verified student and an active provider profile. Payment records model pending, held, released, refunded, and disputed states. The included gateway abstraction deliberately remains unconfigured until a real gateway and webhook signature verifier are supplied; the API never claims money is protected without a verified gateway event.

## Commands

- `npm run build`
- `npm test`
- `npm run test:journey` (requires the API and PostgreSQL to be running)
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run docs:export`

Password recovery and password changes are implemented. Apply the new migration before starting the updated API; configure Resend to enable recovery delivery. See [account implementation and setup](../docs/backend-accounts.md).

University and staff-role management are implemented. Apply the latest migration and bootstrap the first administrator with the trusted server command. See [university directory and staff setup](../docs/backend-universities.md).

Student verification is implemented: automatic university email codes, private Cloudinary evidence, and admin/reviewer document decisions. Configure Cloudinary malware moderation and Resend, apply the latest migration, and connect the frontend forms/dashboard. See [verification setup and frontend flows](../docs/backend-verification.md).

Provider onboarding and approval are implemented. Identity and work are mandatory, CAC optional; profile approval and owner publication are separate. Draft services can now be created during onboarding. Apply the provider review migration and connect the frontend using [provider onboarding and dashboard flows](../docs/backend-provider-onboarding.md).

Catalog/discovery filters and administrator category management are implemented. The configured local Docker database has migrations 0000–0004 applied; no demo data was seeded. See [catalog APIs and database status](../docs/backend-catalog.md).

Collaboration uses participant-only Socket.IO messaging, persisted conversation reads, notification preferences, milestones and guarded job actions. See the [collaboration guide](../docs/backend-collaboration.md).

Paystack collection, verification and signed charge webhooks are implemented. Set PAYSTACK_SECRET_KEY and optional PAYMENT_CALLBACK_URL; see the [payment integration guide](../docs/backend-payments.md). Verified payout accounts, client-approved transfers and finance-authorized full refunds are implemented; see the [settlement guide](../docs/backend-settlements.md). Reconciliation remains unfinished.

Participant dispute cases and admin/finance resolution are implemented; see the [dispute guide](../docs/backend-disputes.md).

Student profile, email changes and deactivation are implemented; see [account management](../docs/backend-account-management.md).

Public support submissions and participant job review lookup are implemented; see [contact/review integration](../docs/backend-contact-and-reviews.md). Set SUPPORT_EMAIL for contact delivery.
