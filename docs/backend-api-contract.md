# Backend API contract handoff

The backend registers **150 operations** under `/api/v1`: 61 existing handlers and 89 contract-only handlers. This inventory covers the backend requirements and current frontend workflows. It is an integration contract, not a claim that all features are functional.

- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs/json`
- OpenAPI YAML: `http://localhost:4000/api/docs/yaml`
- Shareable offline snapshot: [`konet-backend/openapi.json`](../konet-backend/openapi.json)
- Regenerate the snapshot: `cd konet-backend && npm run docs:export`. This builds the API and exports its registered routes without connecting to PostgreSQL or opening a server.

## How the team should use this

The frontend developer can generate client types or build API adapters and mocks from the success schemas in Swagger/OpenAPI. Contract-only endpoints currently return **501 `ENDPOINT_NOT_IMPLEMENTED`**, so they cannot yet provide successful data to live frontend screens. Use the documented success schemas for frontend mocks until the backend developer implements each handler.

Each operation has required/optional input fields, validation constraints, path/query parameters, authentication, target success response, error responses, and `x-implementation-status`. Status values are `implemented`, `contract-only`, and `gateway-unconfigured`. Existing handlers remain in their domain modules; new stubs live in `konet-backend/src/modules/contracts/contracts.controller.ts`. When implementing a stub, move its route into the relevant domain controller, remove the stub, and set its registry `existing` flag to true. Update the response/input contract if behavior changes, then regenerate the snapshot.

Implemented directory, account lookup, audit, and staff-role routes require a live administrator role from the database. Other admin routes remain contract-only and return 501. Read the [staff setup guide](backend-universities.md) to bootstrap the first admin. Payment webhook payloads and signature headers are provisional until the payment provider is selected. The webhook stub performs no processing. No client-supplied status can fund a payment or approve verification.

## Shared conventions

- Use the backend names, not the frontend mock field names: `fullName`, `title`, `description`, `content`, `comment`, `responseTimeMinutes`, and `availability`.
- Money is integer minor units: NGN kobo. `500000` means ₦5,000. Convert only for display.
- Dates are ISO 8601 strings with timezone. Response timestamps use UTC.
- IDs are UUIDs; path parameters named `step` and `gateway` are textual identifiers.
- Lists are JSON arrays. New list endpoints document `limit` (default 20, maximum 100), `offset`, and an optional `status` filter. Existing endpoints only support the query parameters shown for them.
- Bearer authentication uses `Authorization: Bearer <accessToken>`.
- Register/login/refresh return `{ accessToken, user }` and set `konet_refresh` as an HttpOnly cookie. Send credentials for refresh/logout. Refresh token is not a JSON request field.
- Validation errors can contain a string array in `message`; domain errors contain a string and `code`. Consult the shared `Error` schema.
- Do not send card numbers or CVV to Konet. Checkout will return a hosted payment URL after gateway integration.
- Provider creation produces a draft. Approval and publishing are separate actions; publishing must not grant approval.

## Main frontend flows

| Frontend feature | API operations |
| --- | --- |
| Account | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me`; `PATCH /me/profile` |
| Password recovery | `POST /auth/forgot-password`, `/auth/reset-password` |
| University selection | `GET /universities`, `/universities/{id}`, `/universities/{id}/campuses` |
| Verification | `GET /universities/{id}/verification-methods`; `GET/POST /me/student-verification`; email challenge send/confirm |
| Discovery | `GET /providers`, `/providers/{id}`, `/services`, `/categories`; provider services/portfolio/reviews |
| Onboarding | `GET /me/provider-onboarding`; `PATCH /me/provider-onboarding/steps/{step}`; provider profile/evidence/portfolio/service routes |
| Private upload | `POST /uploads/presign`; PUT to returned upload URL; `POST /uploads/{id}/complete`; poll `GET /uploads/{id}` |
| Hiring | `POST /requests`; `GET /requests/{id}`; `POST /quotes`; `GET /quotes/{id}`; `POST /quotes/{id}/accept` |
| Job workspace | `GET /jobs/{id}`; start, mark-complete, confirm-completion, cancel, milestones, conversation, payment, and dispute routes |
| Messaging | `GET /conversations`, `/conversations/{id}`; `GET/POST /conversations/{id}/messages` |
| Notifications | `GET /notifications`; mark one/all read; notification preferences |
| Checkout | `POST /jobs/{jobId}/payments`; poll `GET /jobs/{jobId}/payment`; server verification endpoint |
| Provider earnings | `GET /me/earnings`, `/me/payouts`, `/me/payments`; payout account management |
| Trust | `POST /reviews`; `POST /jobs/{id}/disputes`; dispute reads and decision history |
| Support | `POST /contact` |

## Current limitations to account for

- Forgot-password queues an encrypted reset email when Resend is configured; otherwise returns 503 `EMAIL_DELIVERY_NOT_CONFIGURED`. Read the [account implementation notes](backend-accounts.md) for setup and frontend reset-link handling.
- Checkout is blocked by the unconfigured gateway and returns 503.
- Provider search currently ignores `categoryId` and `maxPriceMinor` even though it accepts them.
- Quote acceptance returns a job; repeating acceptance currently returns 409 rather than the existing job.
- Current completion may change a payment database status to `released`; it does not transfer real money. Payout status has its own future API.
- The existing frontend mock statuses differ from backend statuses. Use the OpenAPI job, payment, verification, and availability enums.
- Resource-specific reviewer/support/finance permissions, provider-specific signing, fee policy, and payout/refund operational rules still need finalization before those routes can become functional.

## Complete route inventory

All paths are relative to `/api/v1`. Request and success schema names refer to OpenAPI `components.schemas`. Array suffixes mean JSON arrays; 204 has no body.

### auth

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | public | RegisterInput | 201 Session | Existing handler |
| POST | `/auth/login` | public | LoginInput | 200 Session | Existing handler |
| POST | `/auth/refresh` | cookie | — | 200 Session | Existing handler |
| POST | `/auth/logout` | cookie | — | 204 No body | Existing handler |
| POST | `/auth/forgot-password` | public | ForgotPasswordInput | 202 Acknowledgement | Existing handler |
| POST | `/auth/reset-password` | public | ResetPasswordInput | 200 Acknowledgement | Existing handler |
| GET | `/auth/me` | user | — | 200 user | Existing handler |

### password

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/me/password` | user | PasswordChangeInput | 200 Acknowledgement | Existing handler |

### health

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | public | — | 200 Health | Existing handler |

### universities

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/universities` | public | — | 200 University[] | Existing handler |
| GET | `/universities/{id}` | public | — | 200 University | Existing handler |
| GET | `/universities/{id}/campuses` | public | — | 200 campuses[] | Existing handler |
| GET | `/universities/{id}/verification-methods` | public | — | 200 VerificationMethods | Existing handler |

### administration

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/universities` | admin | — | 200 universities[] | Existing handler |
| POST | `/admin/universities` | admin | UniversityInput | 201 universities | Existing handler |
| PATCH | `/admin/universities/{id}` | admin | UniversityUpdateInput | 200 universities | Existing handler |
| GET | `/admin/universities/{universityId}/campuses` | admin | — | 200 campuses[] | Existing handler |
| POST | `/admin/universities/{universityId}/campuses` | admin | CampusInput | 201 campuses | Existing handler |
| PATCH | `/admin/universities/{universityId}/campuses/{id}` | admin | CampusUpdateInput | 200 campuses | Existing handler |
| DELETE | `/admin/universities/{universityId}/campuses/{id}` | admin | — | 204 No body | Existing handler |
| GET | `/admin/universities/{universityId}/email-domains` | admin | — | 200 EmailDomain[] | Existing handler |
| POST | `/admin/universities/{universityId}/email-domains` | admin | DomainInput | 201 EmailDomain | Existing handler |
| PATCH | `/admin/universities/{universityId}/email-domains/{id}` | admin | DomainInput | 200 EmailDomain | Existing handler |
| DELETE | `/admin/universities/{universityId}/email-domains/{id}` | admin | — | 204 No body | Existing handler |
| GET | `/admin/audit-events` | admin | — | 200 AuditEvent[] | Existing handler |
| GET | `/admin/users` | admin | — | 200 user[] | Existing handler |
| GET | `/admin/users/{id}` | admin | — | 200 user | Existing handler |
| GET | `/admin/users/{id}/roles` | admin | — | 200 UserRoles | Existing handler |
| POST | `/admin/users/{id}/roles` | admin | StaffRoleInput | 201 UserRoles | Existing handler |
| DELETE | `/admin/users/{id}/roles/{role}` | admin | ReasonInput | 200 UserRoles | Existing handler |
| GET | `/admin/student-verifications` | admin | — | 200 studentVerifications[] | Contract only (501) |
| GET | `/admin/student-verifications/{id}` | admin | — | 200 studentVerifications | Contract only (501) |
| GET | `/admin/provider-verifications` | admin | — | 200 providerVerifications[] | Contract only (501) |
| GET | `/admin/provider-verifications/{id}` | admin | — | 200 providerVerifications | Contract only (501) |
| GET | `/admin/providers` | admin | — | 200 providerProfiles[] | Contract only (501) |
| GET | `/admin/providers/{id}` | admin | — | 200 providerProfiles | Contract only (501) |
| GET | `/admin/disputes` | admin | — | 200 disputes[] | Contract only (501) |
| GET | `/admin/disputes/{id}` | admin | — | 200 disputes | Contract only (501) |
| GET | `/admin/payments` | admin | — | 200 payments[] | Contract only (501) |
| GET | `/admin/payments/{id}` | admin | — | 200 payments | Contract only (501) |
| GET | `/admin/payouts` | admin | — | 200 Payout[] | Contract only (501) |
| GET | `/admin/payouts/{id}` | admin | — | 200 Payout | Contract only (501) |
| PATCH | `/admin/users/{id}/status` | admin | AccountStatusInput | 200 user | Contract only (501) |
| POST | `/admin/student-verifications/{id}/decision` | admin | DecisionInput | 201 Decision | Contract only (501) |
| POST | `/admin/provider-verifications/{id}/decision` | admin | DecisionInput | 201 Decision | Contract only (501) |
| POST | `/admin/providers/{id}/decision` | admin | ProviderDecisionInput | 201 Decision | Contract only (501) |
| POST | `/admin/disputes/{id}/decision` | admin | DisputeDecisionInput | 201 Decision | Contract only (501) |
| POST | `/admin/payments/{id}/refunds` | admin | RefundInput | 202 Refund | Contract only (501) |
| POST | `/admin/payouts/{id}/retry` | admin | ReasonInput | 202 Payout | Contract only (501) |
| POST | `/admin/reconciliations` | admin | ReconciliationInput | 202 Reconciliation | Contract only (501) |
| GET | `/admin/reconciliations` | admin | — | 200 Reconciliation[] | Contract only (501) |
| GET | `/admin/reconciliations/{id}` | admin | — | 200 Reconciliation | Contract only (501) |
| GET | `/admin/reports` | admin | — | 200 Report | Contract only (501) |
| GET | `/admin/categories` | admin | — | 200 serviceCategories[] | Contract only (501) |
| POST | `/admin/categories` | admin | CategoryInput | 201 serviceCategories | Contract only (501) |
| PATCH | `/admin/categories/{id}` | admin | CategoryUpdateInput | 200 serviceCategories | Contract only (501) |

### providers

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/providers` | public | — | 200 ProviderSummary[] | Existing handler |
| GET | `/providers/{id}` | public | — | 200 ProviderDetail | Existing handler |
| POST | `/providers/{id}/favorite` | user | — | 201 FavoriteResult | Existing handler |
| DELETE | `/providers/{id}/favorite` | user | — | 204 No body | Existing handler |
| GET | `/providers/{id}/services` | public | — | 200 services[] | Contract only (501) |
| GET | `/providers/{id}/portfolio` | public | — | 200 portfolioItems[] | Contract only (501) |
| GET | `/providers/{id}/reviews` | public | — | 200 reviews[] | Contract only (501) |

### provider-profile

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/me/provider-profile` | user | ProviderInput | 201 providerProfiles | Existing handler |
| GET | `/me/provider-profile` | user | — | 200 providerProfiles | Contract only (501) |
| PATCH | `/me/provider-profile` | user | ProviderUpdateInput | 200 providerProfiles | Contract only (501) |
| POST | `/me/provider-profile/submit` | user | — | 202 providerProfiles | Contract only (501) |
| POST | `/me/provider-profile/publish` | user | — | 200 providerProfiles | Contract only (501) |
| PATCH | `/me/provider-profile/status` | user | ProviderStatusInput | 200 providerProfiles | Contract only (501) |

### categories

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/categories` | public | — | 200 serviceCategories[] | Existing handler |

### services

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/services` | public | — | 200 ServiceSummary[] | Existing handler |
| POST | `/services` | user | ServiceInput | 201 services | Existing handler |
| GET | `/services/{id}` | public | — | 200 services | Existing handler |
| GET | `/me/services` | user | — | 200 services[] | Existing handler |
| PATCH | `/me/services/{id}` | user | ServiceUpdateInput | 200 services | Existing handler |
| DELETE | `/me/services/{id}` | user | — | 204 No body | Existing handler |

### requests

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/requests` | user | RequestInput | 201 serviceRequests | Existing handler |
| GET | `/requests` | user | — | 200 serviceRequests[] | Existing handler |
| GET | `/requests/{id}` | user | — | 200 serviceRequests | Contract only (501) |
| POST | `/requests/{id}/withdraw` | user | ReasonInput | 200 serviceRequests | Contract only (501) |
| POST | `/requests/{id}/decline` | user | ReasonInput | 200 serviceRequests | Contract only (501) |
| GET | `/requests/{id}/quotes` | user | — | 200 quotes[] | Contract only (501) |
| GET | `/requests/{id}/conversation` | user | — | 200 ConversationDetail | Contract only (501) |

### quotes

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/quotes` | user | QuoteInput | 201 quotes | Existing handler |
| GET | `/quotes` | user | — | 200 quotes[] | Contract only (501) |
| POST | `/quotes/{id}/accept` | user | — | 201 jobs | Existing handler |
| GET | `/quotes/{id}` | user | — | 200 quotes | Contract only (501) |
| POST | `/quotes/{id}/decline` | user | ReasonInput | 200 quotes | Contract only (501) |
| POST | `/quotes/{id}/cancel` | user | ReasonInput | 200 quotes | Contract only (501) |

### jobs

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/jobs` | user | — | 200 jobs[] | Existing handler |
| POST | `/jobs/{id}/start` | user | — | 201 jobs | Existing handler |
| POST | `/jobs/{id}/mark-complete` | user | — | 201 jobs | Existing handler |
| POST | `/jobs/{id}/confirm-completion` | user | — | 201 jobs | Existing handler |
| POST | `/jobs/{id}/disputes` | user | DisputeInput | 201 disputes | Existing handler |
| GET | `/jobs/{jobId}/payment` | user | — | 200 payments | Existing handler |
| POST | `/jobs/{jobId}/payments` | user | — | 201 Checkout | Gateway blocked (503) |
| GET | `/jobs/{id}` | user | — | 200 jobs | Contract only (501) |
| POST | `/jobs/{id}/cancel` | user | ReasonInput | 200 jobs | Contract only (501) |
| GET | `/jobs/{id}/milestones` | user | — | 200 Milestone[] | Contract only (501) |
| POST | `/jobs/{id}/milestones` | user | MilestoneInput | 201 Milestone | Contract only (501) |
| PATCH | `/jobs/{id}/milestones/{milestoneId}` | user | MilestoneUpdateInput | 200 Milestone | Contract only (501) |
| GET | `/jobs/{id}/conversation` | user | — | 200 ConversationDetail | Contract only (501) |
| GET | `/jobs/{id}/review` | user | — | 200 reviews | Contract only (501) |
| POST | `/jobs/{jobId}/payment/verify` | user | — | 200 payments | Contract only (501) |
| GET | `/jobs/{jobId}/payout` | user | — | 200 Payout | Contract only (501) |
| GET | `/jobs/{jobId}/refunds` | user | — | 200 Refund[] | Contract only (501) |

### conversations

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/conversations/{id}/messages` | user | — | 200 messages[] | Existing handler |
| POST | `/conversations/{id}/messages` | user | MessageInput | 201 messages | Existing handler |
| GET | `/conversations` | user | — | 200 ConversationDetail[] | Contract only (501) |
| GET | `/conversations/{id}` | user | — | 200 ConversationDetail | Contract only (501) |
| PATCH | `/conversations/{id}/read` | user | — | 200 Acknowledgement | Contract only (501) |

### reviews

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/reviews` | user | ReviewInput | 201 reviews | Existing handler |

### notifications

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/notifications` | user | — | 200 notifications[] | Existing handler |
| PATCH | `/notifications/{id}/read` | user | — | 200 notifications | Existing handler |
| PATCH | `/notifications/read-all` | user | — | 200 Acknowledgement | Contract only (501) |

### student-verification

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/student-verification` | user | — | 200 VerificationHistory[] | Existing handler |
| POST | `/me/student-verification` | user | StudentVerificationInput | 201 studentVerifications | Existing handler |
| POST | `/me/student-verification/email-challenges` | user | EmailChallengeInput | 202 Challenge | Contract only (501) |
| POST | `/me/student-verification/email-challenges/confirm` | user | ConfirmChallengeInput | 200 studentVerifications | Contract only (501) |

### favorites

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/favorites` | user | — | 200 Favorite[] | Existing handler |

### payment webhooks

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/webhooks/payments/{gateway}` | public | object | 200 Acknowledgement | Contract only (501) |

### contact

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/contact` | public | ContactInput | 202 Contact | Contract only (501) |

### profile

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| PATCH | `/me/profile` | user | ProfileInput | 200 user | Contract only (501) |

### email-change

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/me/email-change` | user | EmailChangeInput | 202 Challenge | Contract only (501) |
| POST | `/me/email-change/confirm` | user | ConfirmChallengeInput | 200 user | Contract only (501) |

### account

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| DELETE | `/me/account` | user | ReasonInput | 204 No body | Contract only (501) |

### provider-verifications

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/provider-verifications` | user | — | 200 VerificationDimension[] | Contract only (501) |
| POST | `/me/provider-verifications` | user | ProviderEvidenceInput | 201 VerificationDimension | Contract only (501) |

### provider-onboarding

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/provider-onboarding` | user | — | 200 Onboarding | Contract only (501) |
| PATCH | `/me/provider-onboarding/steps/{step}` | user | OnboardingStepInput | 200 Onboarding | Contract only (501) |

### portfolio

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/portfolio` | user | — | 200 portfolioItems[] | Contract only (501) |
| POST | `/me/portfolio` | user | PortfolioInput | 201 portfolioItems | Contract only (501) |
| PATCH | `/me/portfolio/{id}` | user | PortfolioUpdateInput | 200 portfolioItems | Contract only (501) |
| DELETE | `/me/portfolio/{id}` | user | — | 204 No body | Contract only (501) |

### notification-preferences

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/notification-preferences` | user | — | 200 NotificationPreferences | Contract only (501) |
| PATCH | `/me/notification-preferences` | user | PreferencesInput | 200 NotificationPreferences | Contract only (501) |

### disputes

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/disputes` | user | — | 200 disputes[] | Contract only (501) |
| GET | `/disputes/{id}` | user | — | 200 disputes | Contract only (501) |
| GET | `/disputes/{id}/decisions` | user | — | 200 Decision[] | Contract only (501) |

### payments

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/payments` | user | — | 200 payments[] | Contract only (501) |

### earnings

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/earnings` | user | — | 200 Earnings | Contract only (501) |

### payouts

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/payouts` | user | — | 200 Payout[] | Contract only (501) |

### payout-accounts

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/payout-accounts` | user | — | 200 PayoutAccount[] | Contract only (501) |
| POST | `/me/payout-accounts` | user | PayoutAccountInput | 201 PayoutAccount | Contract only (501) |
| DELETE | `/me/payout-accounts/{id}` | user | — | 204 No body | Contract only (501) |

### uploads

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/uploads/presign` | user | UploadInput | 201 UploadTicket | Contract only (501) |
| POST | `/uploads/{id}/complete` | user | — | 202 Upload | Contract only (501) |
| GET | `/uploads/{id}` | user | — | 200 Upload | Contract only (501) |
| DELETE | `/uploads/{id}` | user | — | 204 No body | Contract only (501) |
| GET | `/uploads/{id}/download` | user | — | 200 DownloadTicket | Contract only (501) |

