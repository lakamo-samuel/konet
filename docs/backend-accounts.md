# Feature 1: accounts, sessions, and password recovery

Implemented: registration, login, current account, refresh rotation, logout, forgot-password, reset-password, and authenticated password change. Profile editing, account email changes, and account deactivation remain contract-only and will be addressed separately.

## Team setup

1. Run `npm run db:migrate` from `konet-backend` before starting this API version. Migration `0001_deep_mentallo.sql` adds session families, password-reset records, and the email outbox. Existing sessions receive their own family IDs. Previously issued access tokens do not contain the new session binding; users must sign in again.
2. Configure these environment values together:
   - `RESEND_API_KEY`: sending API key.
   - `EMAIL_FROM`: sending email address on a verified Resend domain.
   - `EMAIL_OUTBOX_KEY`: 64 hexadecimal characters representing a 32-byte AES key. Generate with `openssl rand -hex 32`. Keep it stable across restarts and instances; store it securely.
   - `PASSWORD_RESET_URL`: frontend reset page, for example `https://app.example.com/reset-password`. HTTPS is required for production links. The fallback is the first configured frontend origin plus `/reset-password`.
3. Restart the API. A worker polls PostgreSQL every two seconds while email is configured. No Redis is required. In `NODE_ENV=test`, automatic sending is disabled.

No live database migration or real email delivery was performed during development. Migrations and recovery flows were tested against a disposable local PostgreSQL database. The adapter was tested with mocked provider responses. The team must still validate the configured sending domain and real delivery.

## Frontend contract

- `POST /api/v1/auth/forgot-password`, body `{ "email": "student@example.com" }`, returns 202 with the same acknowledgement for known, unknown, inactive, and per-account throttled requests. Missing delivery configuration returns 503 `EMAIL_DELIVERY_NOT_CONFIGURED` for every email address.
- Recovery link: `PASSWORD_RESET_URL#token=<opaque-token>`. Read the fragment with `URLSearchParams(window.location.hash.slice(1))`, remove it from browser history, and keep it out of analytics/logs. The token is not sent to the frontend server in a URL query.
- `POST /api/v1/auth/reset-password`, body `{ "token": "...", "password": "new-password" }`, returns 200 with an acknowledgement. Invalid, expired, or consumed tokens return 400 `INVALID_RESET_TOKEN`. Success clears the refresh cookie and requires a fresh sign-in.
- `POST /api/v1/me/password`, authenticated, body `{ "currentPassword": "...", "newPassword": "..." }`, returns 200. Success revokes all sessions, clears the refresh cookie, and requires sign-in again.
- Send access tokens as `Authorization: Bearer <accessToken>`. Refresh and logout use the HttpOnly `konet_refresh` cookie; include credentials. A refresh revokes the previous access token, so callers must switch to the returned access token.
- A reused refresh token revokes the entire rotation family. Client code should coordinate refresh requests and retry only once; parallel refreshes with the same token force a new sign-in.

## Behavior and protection

- Passwords use Argon2id. Registration normalizes emails and checks active university/campus membership. Unique-email conflicts are translated into 409 even under concurrent registration.
- Every protected request checks a signed access token, its live unexpired session, and active account status. Logout revokes the session family immediately. Password changes and resets revoke every account session.
- Login, refresh, recovery creation, and password changes lock the account row consistently. Refresh rotation and session creation commit together. Reset consumption is conditional and transactional: two concurrent reset requests cannot both succeed.
- Reset tokens contain 32 random bytes. Only SHA-256 hashes are stored in reset records; tokens expire after 30 minutes and can be used once. Issuing a new link invalidates previous links and cancels queued older recovery emails.
- Recovery sends at most three links per account per hour, at least 60 seconds apart. Throttled account requests retain the generic acknowledgement. HTTP recovery/password actions have additional request limits.
- The database outbox encrypts recipient and reset-link content with AES-256-GCM. Short leases and `SKIP LOCKED` coordinate multiple instances. Provider retries reuse one idempotency key. Retryable failures are retried up to five times with exponential backoff; permanent failures stop. Expired jobs are not sent. Payloads are cleared after success or terminal failure; workers log identifiers and safe error categories only.
- Outbox `sent` means the provider accepted the message, not that the recipient received it. Bounce/delivery webhooks, operational alerts, key rotation, and retention cleanup are later operations work.

## Checks

`npm test` runs contract and email-adapter checks. PostgreSQL integration checks are explicitly opt-in: set `AUTH_TEST_DB_SOCKET` to a **disposable PostgreSQL Unix socket directory** on port 55437, then run `npm test`. The integration suite migrates and truncates the dedicated `konet_auth_test` database (created if absent); never point it at a shared or production database. It does not read the application's `DATABASE_URL`.

Resend integration follows the provider's [send-email API contract](https://resend.com/docs/api-reference/emails/send-email) and [idempotency support](https://resend.com/changelog/idempotency-keys). It applies the [email-best-practices skill](/home/kingjoker/.codex/plugins/cache/openai-curated-remote/app-6a3c407853888191beddc2151c2b6f8b/5.0.0/skills/email-best-practices/SKILL.md).
