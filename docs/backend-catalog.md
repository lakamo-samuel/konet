# Catalog and discovery (F5)

Catalog administration and public discovery are implemented. All routes are relative to `/api/v1`; Swagger and the offline OpenAPI snapshot describe their fields. Public results require published, approved providers belonging to active verified student accounts. Services additionally require an active category and active ancestors.

## Public queries

`GET /providers` supports `query`, `universityId`, `campusId`, `categoryId`, `availability`, `maxPriceMinor`, `limit` (default 20, max 100), and `offset` (default 0). Category and price must match the **same active service**: a cheap service in another category cannot satisfy a category-specific price cap. An unpriced custom quote does not match a numeric cap. Provider results are ordered by title then UUID.

`GET /services` supports the same filters plus `providerId`. It searches service title/description; provider search searches provider title/bio. Service results are ordered by creation time descending then UUID. Text search treats `%`, `_`, and backslashes literally. Lists return arrays, not pagination envelopes. Prices are NGN kobo; `maxPriceMinor=500000` means a maximum of ₦5,000.

`GET /categories` returns visible categories ordered by name then UUID. Disabling a category hides its descendants from public category lists and hides their services from service lists/detail, provider detail service collections, and category-filtered provider search. Existing records are preserved. Re-enabling the ancestors restores visibility for otherwise active records. Category activation is also checked when a service is activated or a provider is submitted/published.

The provider's public service, portfolio and review endpoints remain available only for published approved providers. Pausing a provider hides its public services as well as its profile. Publishing services follows the [provider onboarding flow](backend-provider-onboarding.md): create a draft, obtain provider approval, publish the provider, then activate individual services.

## Administrator category management

| Operation | Endpoint | Fields |
| --- | --- | --- |
| List | `GET /admin/categories` | limit, offset; optional status=active/inactive |
| Create | `POST /admin/categories` | name, slug; optional parentId, isActive |
| Update | `PATCH /admin/categories/{id}` | Any name, slug, parentId, isActive |

An active administrator role is required; reviewers, support, finance and students cannot manage categories. Category names are trimmed and limited to 2–120 characters. Slugs are normalized to lowercase, limited to 2–120 characters, and use letters, digits and hyphens. Duplicate slugs return 409; missing parents return 404. A parent cannot be the category itself or a descendant. Concurrent hierarchy changes use a shared database lock to prevent cycles.

Send `parentId: null` to move a category to the root. Other null fields are invalid. `isActive` must be a JSON boolean. An empty update returns 400. Category changes are audited. Deactivation preserves category/service records; the administrator status filter describes a category's own active flag, while public visibility also depends on its ancestors.

Example:

```json
{ "name": "Photography", "slug": "photography", "isActive": true }
```

## Database and validation

The project local PostgreSQL container was started and migrations 0000–0004 were applied and verified on 2026-10-01: five migration journal entries and 33 public tables. No demo accounts were seeded. Catalog changes require no additional schema migration. Tests continue to use separate disposable databases, never the project database.

The full suite passes 76 tests across nine suites. New catalog checks cover combined category/price matching, literal search, numeric pagination validation, admin permissions, duplicate slugs, cyclic parent changes, root reassignment, strict booleans, and visibility of disabled category subtrees. Typecheck, lint, build and offline Swagger export pass. Provider uploads, approval and publication use the existing implementation; payment integration and the remaining hiring workflows are separate features.
