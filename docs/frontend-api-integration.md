# Frontend API integration

The first stage connects account authentication and the common HTTP boundary. Admin screens are deferred.

## Connected now

- Registration with real university and campus IDs.
- Login, logout, recovery requests and password reset at `/reset-password`.
- Backend-authoritative current user, student status and provider ownership.
- [Student verification](frontend-student-verification.md): university email codes, private evidence uploads, scan gating, manual review status and feedback.
- Public university/provider/service/portfolio/review reads.
- [Provider onboarding](frontend-provider-onboarding.md): canonical profiles, services, portfolio, private evidence, review status, publication and service activation.
- Notifications and read actions, including the header count.
- Public contact submission using the backend's queued support delivery.

Backend tokens are stored in HttpOnly, SameSite=Lax cookies on the frontend origin, with Secure enabled in production. Production sign-in/register responses return user data without credentials. Development responses additionally return the access token, which the centralized Axios transport stores in localStorage and sends through Authorization. Refresh tokens remain HttpOnly in both modes. Development retains frontend-origin cookies for server rendering and refresh; cross-origin cookies are not required. Protected API requests forward the access token from the server; user/provider/verification demo cookies cannot authorize HTTP-mode access. Logout revokes the backend refresh session before clearing frontend cookies. Login/logout/reset also clear the client query cache.

## Refresh and recovery

The browser checks session expiry through `/api/frontend/session`. This metadata is only a scheduling hint. POST renews credentials through the backend and stores the rotated cookies. Browser queries retry once after a 401; authentication commands are excluded from that retry. Refresh is shared within a tab and uses Web Locks to serialize supported browsers' same-origin tabs. Without Web Locks, only same-tab serialization is available.

Server components do not rotate credentials while rendering. An expired authenticated page redirects to `/session/refresh`, which posts through the browser refresh coordinator, then reloads the requested page. Backend role/session revocation still takes precedence. The profile screen shows returned verification states rather than fixture labels.

The reset form reads `token` from the recovery link fragment and submits it in the POST body. It clears the fragment after successful reset and asks the user to sign in again. Missing/expired recovery links have an explicit error and a link to request another. The backend's generic recovery acknowledgement is preserved for known and unknown emails.

## Run locally

In `konet-frontend/.env.local`:

```dotenv
KONET_API_URL=http://localhost:4000/api/v1
```

Run `npm run dev` in the frontend. For a deployed backend, set `KONET_API_URL=https://YOUR_API_HOST/api/v1`; your teammate does not need Docker or a local database. The API needs an active university/campus directory for registration; missing directory data is shown rather than replaced with fixtures. Configure Resend for recovery and SUPPORT_EMAIL for contact delivery. These are backend settings; no backend secrets belong in the frontend environment.

Mock mode and fixture data have been removed. Missing HTTP mappings return an explicit error.

Backend `FRONTEND_URL` remains a single canonical frontend URL for email links and redirects. Set `CORS_ORIGINS=https://YOUR_FRONTEND_HOST,http://localhost:3000,http://127.0.0.1:3000` to allow both deployed and local clients for REST and Socket.IO. Exact origins are required, including ports. Frontend development transport depends on the frontend environment, independently of the deployed backend environment.

## Validation and next stages

Run `npm run typecheck`, `npm run lint`, `npm run build`, then `npm run test:integration`. The integration command starts a production Next server and a disposable mocked HTTP backend; it checks registration mapping, cookie flags/privacy, authoritative user state, forged-cookie rejection, CSRF, refresh rotation/recovery, reset and logout. It does not send emails, make payments or write to the project database. `npm run test:integration:dev` repeats the HTTP journey under development and checks bearer-only requests and forged-token rejection. `npm run test:auth-transport` checks localStorage persistence, clearing, disabled storage and production privacy. Browser interaction and actual provider delivery remain deployment checks.

Next: request/quote/job actions, Paystack checkout/payout/account settings, then Socket.IO messaging and remaining trust screens. Existing backend endpoints are implemented; their frontend mapping and UI state transitions remain pending. The seven unfinished admin endpoints stay outside this stage.
