# Staff dashboard and operations

The same frontend deployment serves the marketplace and a separate `/admin` area. Staff use normal sign-in. The backend checks current account status, database roles and session MFA proof on every protected staff request; navigation visibility is not an authorization boundary. No public endpoint can grant a staff role.

## First administrator

Register the intended administrator normally. On a trusted backend server, run:

```sh
cd konet-backend
npm run staff:role -- grant admin@example.com admin
```

Replace the example address with the actual account. The command and dashboard share the same transaction lock, active-account checks, last-active-administrator protection and audit policy. CLI changes record the operating-system user (or `STAFF_OPERATOR_LABEL`) as the trusted operator. Do not put administrator credentials or role grants in frontend environment variables, public seeds or application startup code.

## Staff security

Set `STAFF_MFA_ENCRYPTION_KEY` to a cryptographically random 32-byte key encoded as 64 hex characters. Generate it in a trusted environment with `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'`, then save it in the deployment secret manager and backup it securely. Keep the same key across backend instances and restarts. Losing or replacing it without re-enrolling authenticators makes existing secrets unreadable. `.env` and `.env.example` contain the configuration placeholder; never commit the actual value.

After sign-in, open `/admin/security`, enter the current password, scan the locally generated QR code and confirm an authenticator code. Save the ten recovery codes when they appear; they are shown once and stored only as hashes on the backend. The setup secret and recovery codes are held in component memory and never stored in browser storage. Enrollment expires after ten minutes. An enrolled authenticator cannot be replaced through password-only enrollment.

Verification authorizes that session for 15 minutes. Fresh login/refresh sessions must verify again. Password recovery does not remove MFA. Six-digit codes reject replay; recovery codes work once. Five failed password/code attempts lock staff verification for 15 minutes, with attempts committed in PostgreSQL. Production always enforces MFA, including reviewer access to another person's private evidence. `STAFF_MFA_REQUIRED=false` is allowed only outside production for isolated development/test fixtures. Missing encryption credentials fail closed with 503.

If both authenticator and recovery codes are lost, a trusted operator must handle recovery through the team's controlled operational process. There is no public password-only MFA reset endpoint. Authenticator MFA is not phishing-resistant; this implementation does not claim enterprise SSO or passkey support.

## Pages and permissions

| Pages | Roles |
| --- | --- |
| Accounts, staff assignments, universities, campuses, email domains, categories, audit trail | admin |
| Student documents, provider identity/work/CAC evidence, provider approvals | admin or reviewer |
| Disputes, payments/refunds, payouts, reconciliation, financial reports | admin or finance |
| Staff security | admin, reviewer, finance or support |

Support currently has no independent operational API permissions; an administrator assigns reviewer or finance access when those responsibilities are needed. The UI does not invent unsupported support-ticket operations.

Every listed page reads real endpoints through the existing same-origin frontend adapter. A fixed staff-operation registry centralizes paths, fields, permissions and validation; browser input cannot supply an arbitrary backend URL. Production authentication remains HttpOnly cookies. Development retains the previously configured bearer transport. Review forms include current submission revisions; stale provider decisions are rejected by the backend. Sensitive changes have a confirmation step and preserve the backend's reasons/audits, self-review restrictions and eligibility rules.

Account suspension revokes existing sessions and pending account recovery/email-change credentials, cancels queued account email delivery and pauses active provider publication. Reactivation does not revive old sessions or automatically republish a provider. Deactivation requires settlement of active work/payment obligations. Administrators cannot use the dashboard to disable their own account; both staff changes and self-deactivation preserve a last active administrator.

Dispute detail includes the job, payment, milestones, decision history and up to 100 recent undeleted conversation messages. Review access is audited. Private document downloads are audited, signed and expire after five minutes. Treat downloaded evidence according to the team's retention/access policy.

## Financial reports and reconciliation

Reports use a consistent database snapshot. Collections require verified `charge.success` events; payout and refund totals require successful verified gateway states. Commission is earned only after confirmed provider payout for a released payment. Reserved client funds are reported separately and must not be treated as business revenue. Known collection fees and the count of payments with unknown fees are explicit. These are ledger totals, not bank balance or profit; transfer, custody and operating costs are excluded.

Checkout records now save the payer email used at initialization so later account-email changes do not break verification of new payments. Legacy records without that snapshot fall back to the current account email; historical mismatches require investigation. Collection fees remain null when the gateway supplies no valid fee; no fee is guessed or backfilled.

Reconciliation snapshots payment/payout/refund records by creation time, inclusive `from` and exclusive `to`. A run is limited to 31 days and 1,000 records. One global active run is allowed; identical pending ranges return the existing run, while a different active range returns 409. Narrow the range for larger datasets.

A PostgreSQL queue, renewable lease, ownership token and per-record checkpoints allow interrupted work to resume on another instance. The worker verifies existing gateway references and applies validated idempotent state transitions; it never initializes a charge, transfer or refund. Unattempted settlements are skipped. Mismatches and provider failures produce safe per-record error codes and `completed_with_errors`; they do not fabricate successful settlement. Gateway reversals use the existing dispute/settlement state protections. The dashboard can refresh queued results; the worker runs every 30 seconds outside tests.

Migration `0012` adds staff authenticators and session MFA proof. Migration `0013` adds reconciliation records, checkout payer snapshots and collection-fee tracking. Deploy database migrations before starting the updated backend.

## Verification and deployment

Run backend typecheck/lint, `npm test` with the isolated PostgreSQL test socket, and `npm run docs:export`. Run frontend typecheck/lint/build, both HTTP integration modes and `npm run test:admin` after `npx playwright install chromium`. The browser test starts an isolated local backend fixture and built production frontend; it never sends external emails or moves money. It exercises MFA/recovery-code display, access gates, staff navigation, confirmation forms and responsive layout. Real Paystack callbacks, bank settlement and deployment-origin cookies must still be verified in the deployment environment.

Backend production dependencies are patched, with a Swagger-scoped override for the patched `js-yaml` parser because automatic audit fixing selected an older vulnerable parser. Frontend Next.js is patched to 16.3.8. Keep dependency audits in the release workflow. Remaining development-tool advisories must be assessed separately from production dependencies; do not use forced major downgrades to conceal audit findings.

Actual escrow custody is still not provided by Paystack collection. Production transfers remain disabled until the team configures and verifies the existing transfer controls. Multi-instance Socket.IO still needs the previously documented shared adapter/ticket storage. This dashboard does not make those deployment prerequisites disappear.
