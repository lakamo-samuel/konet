# Feature 2: university directory and staff permissions

Universities, campuses, and approved university-email domains now have working management APIs. Changes require an administrator role and create an audit event in the same database transaction. Directory administration does not require a human to approve each student action.

## Set up the first administrator

1. Apply migrations with `cd konet-backend && npm run db:migrate`. Migration `0002_typical_norrin_radd.sql` adds staff roles and audit events.
2. Register the administrator's normal account, or use an existing active account.
3. From the trusted backend environment, run:

   ```bash
   npm run staff:role -- grant admin@example.com admin
   ```

   The command uses that environment's `DATABASE_URL`. It grants the role and records an operator audit event. No roles were granted in the project database during development.
4. Sign in normally. `GET /api/v1/auth/me` now returns a `roles` array. The frontend can use it for navigation, but the API checks the live role table on every privileged request.

Role changes can subsequently be handled by an admin-facing frontend using the API. The server command can also revoke assignments: `npm run staff:role -- revoke account@example.com reviewer`. Do not expose this command or database access in the browser.

## Staff-management API

All paths below are relative to `/api/v1` and require an active session with the `admin` role.

| Action | Endpoint | Input |
| --- | --- | --- |
| Find accounts | `GET /admin/users` | Optional `email`, `status`, `limit`, `offset` query fields |
| Read account | `GET /admin/users/{id}` | Account UUID |
| Read roles | `GET /admin/users/{id}/roles` | Account UUID |
| Grant role | `POST /admin/users/{id}/roles` | `{ "role": "reviewer", "reason": "Assigned to student document review" }` |
| Revoke role | `DELETE /admin/users/{id}/roles/{role}` | `{ "reason": "Assignment ended" }` |

Supported roles are `admin`, `reviewer`, `support`, and `finance`. Only `admin` currently grants permissions for directory and staff management. Reviewer, support, and finance access will be added to their respective features. A role does not make an unimplemented endpoint functional.

Students cannot assign themselves roles. Role changes are idempotent, require a reason, and are audited. The API prevents removal of the final active administrator, including simultaneous revocation attempts. Revocations take effect on the next request without waiting for a JWT to expire. Administrators cannot grant staff roles to inactive accounts. Role changes use a database advisory lock shared with the operator command.

## Directory API

Public endpoints:

- `GET /universities`: active universities with active campuses, ordered by name and ID.
- `GET /universities/{id}`: an active university and its active campuses.
- `GET /universities/{id}/campuses`: active campus options.
- `GET /universities/{id}/verification-methods`: eligible method choices and approved email domains. University-email verification appears only when at least one approved domain exists.

Administrator endpoints:

- `GET/POST /admin/universities` and `PATCH /admin/universities/{id}`.
- `GET/POST /admin/universities/{universityId}/campuses` and `PATCH/DELETE /admin/universities/{universityId}/campuses/{id}`.
- `GET/POST /admin/universities/{universityId}/email-domains` and `PATCH/DELETE /admin/universities/{universityId}/email-domains/{id}`.
- `GET /admin/audit-events`: audit history with actor, action, resource, reason, details, and timestamp. Operator bootstrap events have a null actor and identify their source in details.

University listing supports `status=active|inactive`, `limit` (default 20, maximum 100), and `offset`. Staff account listing supports `status=active|suspended|deactivated`. Lists return arrays.

Inactive universities and campuses are omitted from public discovery. Deleting a campus deactivates it, preserving account references. Universities are deactivated with `PATCH { "isActive": false }`. Deactivation does not automatically suspend existing accounts or change existing verification decisions.

Email domains are normalized to lowercase ASCII domain names. URLs, email addresses, wildcards, and malformed hostnames are rejected. Domains start unapproved unless an administrator explicitly approves them. Domain names are globally unique; campus slugs are unique within a university; university slugs are globally unique. Cross-university campus/domain updates and deletions return 404. Invalid, null, or empty updates fail validation. Failed mutations do not create success audit events.

## Verification clarification and next feature

Approved email domains are directory configuration, not proof that a student controls an address. The next feature will send a one-time university-email code through Resend and verify it automatically. Students using ID cards or documents will use the manual fallback: a private Cloudinary upload followed by a reviewer decision. Cloudinary is the selected storage provider; its upload/access/scanning integration and the review queue are not implemented by this directory feature.

## Verification performed

PostgreSQL API tests cover authentication, student/reviewer permission denials, role revocation, role assignment auditing, last-admin protection, normalized domains, duplicates, parent ownership, inactive visibility, campus preservation, request validation, and pagination. Tests use dedicated disposable `konet_directory_test` and `konet_auth_test` databases under an explicitly selected local Unix socket. No project database changes or real emails are used by these tests.
