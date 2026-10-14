# Continuous integration

`.github/workflows/ci.yml` runs automatically on pushes and pull requests, and can also be started manually from GitHub Actions. Frontend and backend checks run independently:

- **Frontend:** dependency install, ESLint, TypeScript, auth/upload/payment/realtime/settings helpers, production build, mocked HTTP integration, and Playwright browser coverage.
- **Backend:** dependency install, ESLint, TypeScript, the Jest suite, and production build. PostgreSQL is provisioned for the integration suites.

The workflow only verifies code; it does not deploy to a hosting provider and does not require provider credentials, paid hosting features, or GitHub environment secrets. To make successful checks required before merging, configure the repository's `main` branch ruleset to require `Frontend checks` and `Backend checks`.

Production deployment is intentionally separate from this checks-only workflow. Hosting can be configured later using the selected provider's standard Git integration or deployment workflow.
