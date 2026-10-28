# Verification record

Initial browser and Supabase-schema checks: 26 October 2026. PostgreSQL integration and deployment preparation updated on 28 October 2026.

- Next.js 16.4.3 production build: passed. Homepage is statically rendered; admin and API routes are dynamic.
- TypeScript check: passed.
- Automated tests: 37 passed across six files. Tests cover request validation, origins/body limits, persistence failures, safe retries, rate limits, signed sessions, expiry, rotation, login/logout, and the optional PostgreSQL adapter with verified TLS and parameterized queries.
- SQL: the unchanged setup script executed successfully in PostgreSQL 18.6 through PGlite 0.5.11. Eleven checks passed, covering grants, RLS, valid insertion, denied anonymous access, denied updates/deletes, invalid planner data, rate-limit exhaustion and expiry reset.
- Browser: inspected desktop, 375px mobile and 768px tablet layouts. No horizontal page overflow at the tested narrow widths. Verified mobile navigation, native arrow-key service selection, integration selection, summary/form synchronization, field errors and error focus. A storage-unavailable response preserves entered values and does not display success.
- Admin: an unsigned browser visiting `/admin` redirects to `/admin/login`. The unit tests exercise valid/forged/expired session cookies and password checks.

- Direct PostgreSQL schema: ten additional PGlite checks passed for restricted runtime access, constraints, rate limiting and pagination.
- Hosted Neon database: provisioned with a separate SQL-created application login. A fresh authenticated connection confirmed no superuser, role creation, database creation or RLS-bypass privileges. Enquiry reads and the rate-limit function work; DELETE and private-counter reads are denied.
- End-to-end check: twelve checks passed using the local production server connected to hosted Neon. One clearly labelled synthetic enquiry was persisted, an identical retry returned success without duplication, a conflicting UUID was rejected, invalid requests were rejected, wrong-password login failed, correct-password login succeeded, the authenticated admin table displayed the saved enquiry, and logout cleared the secure session cookie.

Deployment status: successfully deployed to the user's Vercel Hobby account at https://migsak-redesign-assignment.vercel.app on 28 October 2026. Vercel's cloud production build passed. All twelve end-to-end checks also passed against this public origin. The deployed homepage was inspected in the browser. DATABASE_URL, ADMIN_PASSWORD and SESSION_SECRET are saved as Production secrets; APP_ORIGIN is saved as Production configuration.

Neon ownership remains pending. The user explicitly chose to keep the database temporary. Provider expiry: 30 October 2026 at 20:42 UTC / 31 October 2026 at 02:12 IST. After that, enquiry persistence and admin login will stop working unless the database is claimed or replaced. The Vercel site itself is deployed in the user's account and does not have this temporary database expiry. A fresh restricted database connection, one additional live enquiry save and authenticated admin viewing passed after the claim attempt.

Limitations: hosted Supabase was not configured; the live database verification used Neon. PGlite is single-connection; its checks do not exercise multiple concurrent PostgreSQL connections. The hosted database remains temporary by user choice.

The temporary local preview was used only for QA. Test dependencies and temporary database assets outside this project are excluded from the source archive.
