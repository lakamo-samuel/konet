# Frontend API integration

The first stage connects account authentication and the common HTTP boundary. Admin screens are deferred.

## Connected now

- Registration with real university and campus IDs.
- Login, logout, recovery requests and password reset at `/reset-password`.
- Backend-authoritative current user, student status and provider ownership.
- Public university/provider/service/portfolio/review reads.
- Notifications and read actions, including the header count.
- Public contact submission using the backend's queued support delivery.

Backend tokens are stored in HttpOnly, SameSite=Lax cookies on the frontend origin, with Secure enabled in production. Responses to browser sign-in/register commands return user data, never credentials. Protected API requests forward the access token from the server; user/provider/verification demo cookies cannot authorize HTTP-mode access. Logout revokes the backend refresh session before clearing frontend cookies. Login/logout/reset also clear the client query cache.

## Refresh and recovery

The browser checks session expiry through `/api/frontend/session`. This metadata is only a scheduling hint. POST renews credentials through the backend and stores the rotated cookies. Browser queries retry once after a 401; authentication commands are excluded from that retry. Refresh is shared within a tab and uses Web Locks to serialize supported browsers' same-origin tabs. Without Web Locks, only same-tab serialization is available.

Server components do not rotate credentials while rendering. An expired authenticated page redirects to `/session/refresh`, which posts through the browser refresh coordinator, then reloads the requested page. Backend role/session revocation still takes precedence. The profile screen shows returned verification states rather than fixture labels.

The reset form reads `token` from the recovery link fragment and submits it in the POST body. It clears the fragment after successful reset and asks the user to sign in again. Missing/expired recovery links have an explicit error and a link to request another. The backend's generic recovery acknowledgement is preserved for known and unknown emails.

## Run locally

In `konet-frontend/.env.local`:

```dotenv
KONET_DATA_SOURCE=http
KONET_API_URL=http://localhost:4000/api/v1
```

Start PostgreSQL and the backend, then run `npm run dev` in the frontend. The API needs an active university/campus directory for registration; missing directory data is shown rather than replaced with fixtures. Configure Resend for recovery and SUPPORT_EMAIL for contact delivery. These are backend settings; no backend secrets belong in the frontend environment.

`http` is the default. Explicit `mock` mode remains available for previewing the unfinished fixture screens. Missing HTTP mappings return a visible error and never silently use fixture data.

## Validation and next stages

Run `npm run typecheck`, `npm run lint`, `npm run build`, then `npm run test:integration`. The integration command starts a production Next server and a disposable mocked HTTP backend; it checks registration mapping, cookie flags/privacy, authoritative user state, forged-cookie rejection, CSRF, refresh rotation/recovery, reset and logout. It does not send emails, make payments or write to the project database. Browser interaction and actual provider delivery remain deployment checks.

Next: student verification and private uploads, provider onboarding/management, request/quote/job actions, Paystack checkout/payout/account settings, then Socket.IO messaging and remaining trust screens. Existing backend endpoints are implemented; their frontend mapping and UI state transitions remain pending. The seven unfinished admin endpoints stay outside this stage.
