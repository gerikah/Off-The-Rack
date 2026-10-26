# Development

The current application and all setup instructions are documented in [README.md](../README.md) and [docs/reference/architecture.md](reference/architecture.md).

Use Node.js 22+ and npm. Run `npm ci`, configure ignored `.env.local` from `.env.example`, then `npm run dev`.

Validation: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:db`, `npm test`, `npm run build`, `npm run analyze:bundle`, `npm run audit:secrets`, `npm audit`.

Browser tests isolate Supabase/Auth/Storage with a fixture at 4318 and Next at 3100, clear the email provider key, and disable campaigns. Do not run concurrent suites or another Next dev server in the same checkout. `npm run test:db` uses in-memory PostgreSQL through PGlite, not a live database.

The browser-test runner sets `OTR_BROWSER_TEST=1` for its child processes. Combined with the exact fixture URL `http://127.0.0.1:4318`, this permits the production test build to optimize fixture images. Normal production builds keep the default private-IP image restriction.

Do not rerun historical `001_storefront.sql`. Follow the staging and migration procedure in the project documentation for new migrations 003?005. Historical implementation reports describe their original checkpoint, not the current feature set.
