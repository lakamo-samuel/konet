# Konet frontend

Next.js App Router frontend. Live HTTP integration is now the default; see [integration status and setup](../docs/frontend-api-integration.md).

Copy `.env.example` to `.env.local`, set `KONET_API_URL` to the local or deployed API, then run `npm run dev`. Authentication, public catalog reads, notifications, contact, student verification and provider onboarding are connected. Remaining student/provider workflows are being integrated feature by feature. Mock adapters and fixtures have been removed. Development uses localStorage access tokens for browser requests; production uses HttpOnly cookies. Same-origin cookies support server rendering and secure refresh in both modes.

Checks: `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:integration` (after build). `npm run test:uploads` checks the private upload helper, and `npm run test:integration:dev` checks development mode. The integration test uses a local mocked backend and does not send real messages or payments.
