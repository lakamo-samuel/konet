# Backend API contract handoff

The backend registers **153 operations** under `/api/v1`: 146 implemented handlers and 7 contract-only handlers. This inventory covers the backend requirements and current frontend workflows. It is an integration contract, not a claim that all features are functional.

- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs/json`
- OpenAPI YAML: `http://localhost:4000/api/docs/yaml`
- Shareable offline snapshot: [`konet-backend/openapi.json`](../konet-backend/openapi.json)
- Regenerate the snapshot: `cd konet-backend && npm run docs:export`. This builds the API and exports its registered routes without connecting to PostgreSQL or opening a server.

## How the team should use this

The frontend developer can generate client types or build API adapters and mocks from the success schemas in Swagger/OpenAPI. Contract-only endpoints currently return **501 `ENDPOINT_NOT_IMPLEMENTED`**, so they cannot yet provide successful data to live frontend screens. Use the documented success schemas for frontend mocks until the backend developer implements each handler.

Each operation has required/optional input fields, validation constraints, path/query parameters, authentication, target success response, error responses, and `x-implementation-status`. Status values are `implemented` and `contract-only`; implemented integrations can still require credentials. Existing handlers remain in their domain modules; new stubs live in `konet-backend/src/modules/contracts/contracts.controller.ts`. When implementing a stub, move its route into the relevant domain controller, remove the stub, and set its registry `existing` flag to true. Update the response/input contract if behavior changes, then regenerate the snapshot.

Implemented directory, account lookup, audit, and staff-role routes require a live administrator role from the database. Student and provider review routes now require an admin or reviewer role. Other admin routes remain contract-only and return 501. See the [verification integration guide](backend-verification.md). Read the [staff setup guide](backend-universities.md) to bootstrap the first admin. Paystack charge webhooks now validate the raw-body signature and verify transactions server-side; see the [payment guide](backend-payments.md). No client-supplied status can fund a payment or approve verification.

Live messaging uses Socket.IO namespace `/chat` on the backend origin, with transport path `/socket.io`. See the [collaboration guide](backend-collaboration.md) for events, authentication, acknowledgements and frontend integration. REST routes support history and reconnect recovery.

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
| Private upload | `POST /uploads/presign`; POST multipart/form-data to returned Cloudinary upload URL; repeat `POST /uploads/{id}/complete` while scanning; `GET /uploads/{id}` reads stored metadata |
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
- Paystack checkout is implemented; add PAYSTACK_SECRET_KEY to enable it. Empty credentials return 503.
- Provider category/price filters are implemented and must match the same active service. See the [catalog guide](backend-catalog.md).
- Quote acceptance is transactional and retry-safe: repeating acceptance of the same quote returns the original job. See the [hiring guide](backend-hiring.md).
- Client confirmation atomically queues payout and sets payment to release_pending. Only server-verified transfers mark funds released. Finance-authorized full refunds are durably queued. See the [collaboration guide](backend-collaboration.md).
- The existing frontend mock statuses differ from backend statuses. Use the OpenAPI job, payment, verification, and availability enums.
- Permissions for remaining contract-only resources, financial reconciliation and reporting remain unfinished. New quotes snapshot the implemented 10% commission; see [commission policy](backend-commission.md).

- Student verification and provider onboarding/review are implemented; live email and evidence uploads need Resend and Cloudinary malware moderation configured. See the [verification setup guide](backend-verification.md) and [provider onboarding guide](backend-provider-onboarding.md).

## Complete route inventory

All paths are relative to `/api/v1`. Request and success schema names refer to OpenAPI `components.schemas`. Array suffixes mean JSON arrays; 204 has no body.

### auth

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | public | RegisterInput | 201 Session | Existing handler |
| POST | `/auth/login` | public | LoginInput | 200 Session | Existing handler |
| POST | `/auth/refresh` | refresh cookie | — | 200 Session | Existing handler |
| POST | `/auth/logout` | refresh cookie | — | 204 No body | Existing handler |
| POST | `/auth/forgot-password` | public | ForgotPasswordInput | 202 Acknowledgement | Existing handler |
| POST | `/auth/reset-password` | public | ResetPasswordInput | 200 Acknowledgement | Existing handler |
| GET | `/auth/me` | authenticated | — | 200 user | Existing handler |

### password

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/me/password` | authenticated | PasswordChangeInput | 200 Acknowledgement | Existing handler |

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
| GET | `/admin/provider-verifications` | admin/reviewer | — | 200 providerVerifications[] | Existing handler |
| GET | `/admin/provider-verifications/{id}` | admin/reviewer | — | 200 ProviderEvidenceReviewDetail | Existing handler |
| POST | `/admin/provider-verifications/{id}/decision` | admin/reviewer | ProviderEvidenceDecisionInput | 201 ProviderReviewDecision | Existing handler |
| GET | `/admin/providers` | admin/reviewer | — | 200 providerProfiles[] | Existing handler |
| GET | `/admin/providers/{id}` | admin/reviewer | — | 200 ProviderReviewDetail | Existing handler |
| POST | `/admin/providers/{id}/decision` | admin/reviewer | ProviderDecisionInput | 201 ProviderReviewDecision | Existing handler |
| GET | `/admin/student-verifications` | admin/reviewer | — | 200 studentVerifications[] | Existing handler |
| GET | `/admin/student-verifications/{id}` | admin/reviewer | — | 200 studentVerifications | Existing handler |
| POST | `/admin/student-verifications/{id}/decision` | admin/reviewer | DecisionInput | 201 Decision | Existing handler |
| GET | `/admin/disputes` | admin or finance | — | 200 disputes[] | Implemented |
| GET | `/admin/disputes/{id}` | admin or finance | — | 200 disputes | Implemented |
| GET | `/admin/payments` | admin | — | 200 payments[] | Contract only (501) |
| GET | `/admin/payments/{id}` | admin | — | 200 payments | Contract only (501) |
| GET | `/admin/payouts` | admin or finance | — | 200 Payout[] | Implemented |
| GET | `/admin/payouts/{id}` | admin or finance | — | 200 Payout | Implemented |
| PATCH | `/admin/users/{id}/status` | admin | AccountStatusInput | 200 user | Contract only (501) |
| POST | `/admin/disputes/{id}/decision` | admin or finance | DisputeDecisionInput | 201 Decision | Implemented |
| POST | `/admin/payments/{id}/refunds` | admin or finance | RefundInput | 202 Refund | Implemented |
| POST | `/admin/payouts/{id}/retry` | admin or finance | ReasonInput | 202 Payout | Implemented |
| POST | `/admin/reconciliations` | admin | ReconciliationInput | 202 Reconciliation | Contract only (501) |
| GET | `/admin/reconciliations` | admin | — | 200 Reconciliation[] | Contract only (501) |
| GET | `/admin/reconciliations/{id}` | admin | — | 200 Reconciliation | Contract only (501) |
| GET | `/admin/reports` | admin | — | 200 Report | Contract only (501) |
| GET | `/admin/categories` | admin | — | 200 serviceCategories[] | Existing handler |
| POST | `/admin/categories` | admin | CategoryInput | 201 serviceCategories | Existing handler |
| PATCH | `/admin/categories/{id}` | admin | CategoryUpdateInput | 200 serviceCategories | Existing handler |

### providers

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/providers` | public | — | 200 ProviderSummary[] | Existing handler |
| GET | `/providers/{id}` | public | — | 200 ProviderDetail | Existing handler |
| GET | `/providers/{id}/services` | public | — | 200 services[] | Existing handler |
| GET | `/providers/{id}/portfolio` | public | — | 200 portfolioItems[] | Existing handler |
| GET | `/providers/{id}/reviews` | public | — | 200 reviews[] | Existing handler |
| POST | `/providers/{id}/favorite` | authenticated | — | 201 FavoriteResult | Existing handler |
| DELETE | `/providers/{id}/favorite` | authenticated | — | 204 No body | Existing handler |

### provider-profile

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/me/provider-profile` | authenticated | ProviderInput | 201 providerProfiles | Existing handler |
| GET | `/me/provider-profile` | authenticated | — | 200 providerProfiles | Existing handler |
| PATCH | `/me/provider-profile` | authenticated | ProviderUpdateInput | 200 providerProfiles | Existing handler |
| POST | `/me/provider-profile/submit` | authenticated | — | 202 providerProfiles | Existing handler |
| POST | `/me/provider-profile/publish` | authenticated | — | 200 providerProfiles | Existing handler |
| PATCH | `/me/provider-profile/status` | authenticated | ProviderStatusInput | 200 providerProfiles | Existing handler |

### provider-verifications

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/provider-verifications` | authenticated | — | 200 VerificationDimension[] | Existing handler |
| POST | `/me/provider-verifications` | authenticated | ProviderEvidenceInput | 201 VerificationDimension | Existing handler |

### provider-onboarding

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/provider-onboarding` | authenticated | — | 200 Onboarding | Existing handler |
| PATCH | `/me/provider-onboarding/steps/{step}` | authenticated | OnboardingStepInput | 200 Onboarding | Existing handler |

### portfolio

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/portfolio` | authenticated | — | 200 portfolioItems[] | Existing handler |
| POST | `/me/portfolio` | authenticated | PortfolioInput | 201 portfolioItems | Existing handler |
| PATCH | `/me/portfolio/{id}` | authenticated | PortfolioUpdateInput | 200 portfolioItems | Existing handler |
| DELETE | `/me/portfolio/{id}` | authenticated | — | 204 No body | Existing handler |

### uploads

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/uploads/presign` | authenticated | UploadInput | 201 UploadTicket | Existing handler |
| POST | `/uploads/{id}/complete` | authenticated | — | 202 Upload | Existing handler |
| GET | `/uploads/{id}` | authenticated | — | 200 Upload | Existing handler |
| DELETE | `/uploads/{id}` | authenticated | — | 204 No body | Existing handler |
| GET | `/uploads/{id}/download` | authenticated | — | 200 DownloadTicket | Existing handler |

### categories

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/categories` | public | — | 200 serviceCategories[] | Existing handler |

### services

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/services` | public | — | 200 ServiceSummary[] | Existing handler |
| POST | `/services` | authenticated | ServiceInput | 201 services | Existing handler |
| GET | `/services/{id}` | public | — | 200 services | Existing handler |
| GET | `/me/services` | authenticated | — | 200 services[] | Existing handler |
| PATCH | `/me/services/{id}` | authenticated | ServiceUpdateInput | 200 services | Existing handler |
| DELETE | `/me/services/{id}` | authenticated | — | 204 No body | Existing handler |

### requests

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/requests` | authenticated | RequestInput | 201 serviceRequests | Existing handler |
| GET | `/requests` | authenticated | — | 200 serviceRequests[] | Existing handler |
| GET | `/requests/{id}` | authenticated | — | 200 serviceRequests | Existing handler |
| POST | `/requests/{id}/withdraw` | authenticated | ReasonInput | 200 serviceRequests | Existing handler |
| POST | `/requests/{id}/decline` | authenticated | ReasonInput | 200 serviceRequests | Existing handler |
| GET | `/requests/{id}/quotes` | authenticated | — | 200 quotes[] | Existing handler |
| GET | `/requests/{id}/conversation` | authenticated | — | 200 ConversationDetail | Existing handler |

### quotes

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/quotes` | authenticated | QuoteInput | 201 quotes | Existing handler |
| GET | `/quotes` | authenticated | — | 200 quotes[] | Existing handler |
| POST | `/quotes/{id}/accept` | authenticated | — | 201 jobs | Existing handler |
| GET | `/quotes/{id}` | authenticated | — | 200 quotes | Existing handler |
| POST | `/quotes/{id}/decline` | authenticated | ReasonInput | 200 quotes | Existing handler |
| POST | `/quotes/{id}/cancel` | authenticated | ReasonInput | 200 quotes | Existing handler |

### jobs

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/jobs` | authenticated | — | 200 jobs[] | Existing handler |
| POST | `/jobs/{id}/start` | authenticated | — | 200 jobs | Existing handler |
| POST | `/jobs/{id}/mark-complete` | authenticated | — | 200 jobs | Existing handler |
| POST | `/jobs/{id}/confirm-completion` | authenticated | — | 200 jobs | Existing handler |
| POST | `/jobs/{id}/disputes` | authenticated | DisputeInput | 201 disputes | Existing handler |
| GET | `/jobs/{jobId}/payment` | authenticated | — | 200 payments | Existing handler |
| POST | `/jobs/{jobId}/payments` | authenticated | — | 201 Checkout | Existing handler (credentials required) |
| GET | `/jobs/{id}` | authenticated | — | 200 jobs | Existing handler |
| POST | `/jobs/{id}/cancel` | authenticated | ReasonInput | 200 jobs | Existing handler |
| GET | `/jobs/{id}/milestones` | authenticated | — | 200 Milestone[] | Existing handler |
| POST | `/jobs/{id}/milestones` | authenticated | MilestoneInput | 201 Milestone | Existing handler |
| PATCH | `/jobs/{id}/milestones/{milestoneId}` | authenticated | MilestoneUpdateInput | 200 Milestone | Existing handler |
| GET | `/jobs/{id}/conversation` | authenticated | — | 200 ConversationDetail | Existing handler |
| GET | `/jobs/{id}/review` | authenticated | — | 200 reviews | Implemented |
| POST | `/jobs/{jobId}/payment/verify` | authenticated | — | 200 payments | Existing handler |
| GET | `/jobs/{jobId}/payout` | authenticated | — | 200 Payout | Implemented |
| GET | `/jobs/{jobId}/refunds` | authenticated | — | 200 Refund[] | Implemented |

### conversations

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/conversations/{id}/messages` | authenticated | — | 200 messages[] | Existing handler |
| POST | `/conversations/{id}/messages` | authenticated | MessageInput | 201 messages | Existing handler |
| GET | `/conversations` | authenticated | — | 200 ConversationDetail[] | Existing handler |
| GET | `/conversations/{id}` | authenticated | — | 200 ConversationDetail | Existing handler |
| PATCH | `/conversations/{id}/read` | authenticated | — | 200 Acknowledgement | Existing handler |

### reviews

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/reviews` | authenticated | ReviewInput | 201 reviews | Existing handler |

### notifications

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/notifications` | authenticated | — | 200 notifications[] | Existing handler |
| PATCH | `/notifications/{id}/read` | authenticated | — | 200 notifications | Existing handler |
| PATCH | `/notifications/read-all` | authenticated | — | 200 Acknowledgement | Existing handler |

### student-verification

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/student-verification` | authenticated | — | 200 studentVerifications[] | Existing handler |
| POST | `/me/student-verification` | authenticated | StudentVerificationInput | 201 studentVerifications | Existing handler |
| POST | `/me/student-verification/email-challenges` | authenticated | EmailChallengeInput | 202 Challenge | Existing handler |
| POST | `/me/student-verification/email-challenges/confirm` | authenticated | ConfirmChallengeInput | 200 studentVerifications | Existing handler |

### favorites

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/favorites` | authenticated | — | 200 Favorite[] | Existing handler |

### payment webhooks

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/webhooks/payments/{gateway}` | webhook | — | 200 Acknowledgement | Existing handler |

### contact

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/contact` | public | ContactInput | 202 Contact | Implemented |

### profile

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| PATCH | `/me/profile` | authenticated | ProfileInput | 200 user | Implemented |

### email-change

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| POST | `/me/email-change` | authenticated | EmailChangeInput | 202 Challenge | Implemented |
| POST | `/me/email-change/confirm` | authenticated | ConfirmChallengeInput | 200 user | Implemented |

### account

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| DELETE | `/me/account` | authenticated | ReasonInput | 204 No body | Implemented |

### notification-preferences

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/notification-preferences` | authenticated | — | 200 NotificationPreferences | Existing handler |
| PATCH | `/me/notification-preferences` | authenticated | PreferencesInput | 200 NotificationPreferences | Existing handler |

### disputes

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/disputes` | authenticated | — | 200 disputes[] | Implemented |
| GET | `/disputes/{id}` | authenticated | — | 200 disputes | Implemented |
| GET | `/disputes/{id}/decisions` | authenticated | — | 200 Decision[] | Implemented |

### payments

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/payments` | authenticated | — | 200 payments[] | Existing handler |

### earnings

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/earnings` | authenticated | — | 200 Earnings | Implemented |

### payouts

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/payouts` | authenticated | — | 200 Payout[] | Implemented |

### payout-accounts

| Method | Path | Access | Request schema | Success | Current status |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/payout-accounts` | authenticated | — | 200 PayoutAccount[] | Implemented |
| POST | `/me/payout-accounts` | authenticated | PayoutAccountInput | 201 PayoutAccount | Implemented |
| DELETE | `/me/payout-accounts/{id}` | authenticated | — | 204 No body | Implemented |

Authenticated `GET /payout-banks` returns the supported Nigerian bank list (`Bank[]`) for account setup. See [settlement integration](backend-settlements.md).

Dispute reads and admin/finance final resolution are implemented; see [dispute integration](backend-disputes.md).

Student profile editing, email changes and account deactivation are implemented; see [account management](backend-account-management.md).

Contact submission and participant job review lookup are implemented; see [integration guide](backend-contact-and-reviews.md). Contact requires SUPPORT_EMAIL and the existing Resend settings.
