# Konet frontend

Next.js App Router frontend. Live HTTP integration is now the default; see [integration status and setup](../docs/frontend-api-integration.md).

Copy `.env.example` to `.env.local`, start the backend and its database, then run `npm run dev`. Authentication, public catalog reads, notifications and contact are connected. Remaining student/provider workflows are being integrated feature by feature. Explicit `KONET_DATA_SOURCE=mock` keeps the fixture preview available.

Checks: `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:integration` (after build). The integration test uses a local mocked backend and does not send real messages or payments.
