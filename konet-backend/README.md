# Konet API

Production-oriented NestJS modular monolith for Konet's student service marketplace. PostgreSQL and Drizzle are the source of truth; money is stored in integer minor units. Redis and BullMQ are intentionally omitted until a real queue, distributed socket, or caching requirement exists.

## Local setup

1. Copy `.env.example` to `.env` and replace both JWT secrets.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Run `npm ci`, `npm run db:migrate`, and `npm run db:seed`.
4. Start the API with `npm run start:dev`.

Set `KONET_API_URL=http://localhost:4000/api/v1` in the Next.js frontend environment to use API-backed university, provider, discovery, and service repositories.

The REST API is rooted at `/api/v1`; Swagger is at `/api/docs`; health is at `/api/v1/health`.

## Security and domain boundaries

Access tokens are short-lived. Refresh tokens are held in an HttpOnly cookie, hashed in PostgreSQL, rotated on every refresh, and revocable. Protected resources validate the current user against request, provider, job, conversation, notification, review, and dispute ownership. Quote acceptance and job/payment creation are one database transaction, reinforced with unique constraints.

Provider publishing requires a verified student and an active provider profile. Payment records model pending, held, released, refunded, and disputed states. The included gateway abstraction deliberately remains unconfigured until a real gateway and webhook signature verifier are supplied; the API never claims money is protected without a verified gateway event.

## Commands

- `npm run build`
- `npm test`
- `npm run test:journey` (requires the API and PostgreSQL to be running)
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`
