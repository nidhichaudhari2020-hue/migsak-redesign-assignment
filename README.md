# Migsak homepage redesign

An assignment redesign of Migsak's homepage. [Live demo](https://migsak-redesign-assignment.vercel.app) · [Protected admin](https://migsak-redesign-assignment.vercel.app/admin). Admin credentials are provided separately and are not stored in this repository.

Next.js App Router, React, Tailwind CSS and PostgreSQL, through either Supabase or a direct connection. The homepage includes a keyboard-accessible phase planner and an enquiry form. `/admin` shows stored enquiries after password authentication.

The page paraphrases services and projects from [Migsak's website](https://www.migsak.com/). It does not add testimonials, client counts or performance claims. Planner output is an indicative starting point; timing and pricing require scoping.

## Local setup

Use Node.js 22 and the included lockfile:

```bash
npm ci
```

Copy `.env.example` to `.env.local` and populate these five variables:

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin, initially `http://localhost:3000`. |
| `SUPABASE_URL` | Your project's URL, such as `https://PROJECT.supabase.co`. |
| `SUPABASE_SECRET_KEY` | A Supabase server secret key, beginning `sb_secret_`. |
| `ADMIN_PASSWORD` | A separately generated password of at least 16 characters. |
| `SESSION_SECRET` | A separately generated random secret of at least 32 characters. |

Generate each secret locally by running this command separately for each value:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep `.env.local` out of source control. None of these variables should be prefixed with `NEXT_PUBLIC_`. The Supabase key is used only by server modules and must never be sent to the browser.

Create a **fresh Supabase project**, open its SQL Editor, and run `supabase/schema.sql` once. The script creates the enquiry table, constraints, indexes and persistent rate-limit function inside a transaction. It is a first-install script, not an idempotent migration for an existing database. No Supabase Auth user or publishable key is needed for this implementation.

### Direct PostgreSQL alternative

For a provider such as Neon, run `postgres/schema.sql` once as the database owner. It creates a `migsak_app` role with only enquiry SELECT/INSERT and rate-limit function EXECUTE privileges. Create a separate, randomly passworded `LOGIN` role through SQL with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, then grant it `migsak_app`. Use that restricted login's TLS connection string as `DATABASE_URL`; keep the owner credential out of the deployed app. Verify a fresh connection can insert/select enquiries and execute the limiter, while DELETE, schema creation and private-counter reads are denied.

When `DATABASE_URL` is populated, the server uses this connection instead of Supabase; the Supabase variables can be omitted. `APP_ORIGIN`, `ADMIN_PASSWORD` and `SESSION_SECRET` remain required. The pool uses at most two connections per server process, verified TLS, and ten-second connection/query/statement timeouts. Temporary databases must be claimed before their provider's expiry; they are not permanent storage until claimed. After claiming, recheck the restricted login and update the deployment's connection string if the provider rotates credentials.

Start the app:

```bash
npm run dev
```

Visit `http://localhost:3000`, submit an enquiry, then open `/admin` and sign in with `ADMIN_PASSWORD`. Restart the development server after changing environment variables. Without database configuration, the homepage can render, but submissions and login deliberately fail rather than claiming success.

## Project map

| File | Responsibility |
| --- | --- |
| `app/page.tsx` | Homepage composition and truthful agency content. |
| `components/project-builder.tsx` | Planner state, native controls, enquiry form and submission feedback. |
| `app/api/enquiry/route.ts` | Public POST endpoint: origin check, validation, rate limit and database insert. |
| `lib/enquiry-schema.ts` | Shared Zod schema and TypeScript types. |
| `lib/http.ts` | Exact-origin enforcement, streamed body-size limits and safe JSON responses. |
| `lib/supabase.ts` | Server-only Supabase client with uncached database requests. |
| `lib/database.ts` | Parameterized PostgreSQL operations with a Supabase fallback. |
| `postgres/schema.sql` | Direct PostgreSQL schema and restricted runtime-role privileges. |
| `supabase/schema.sql` | Database access restrictions and atomic rate-limit counter. |
| `app/admin/page.tsx` | Server-authorized enquiry table, newest first, with 50-row pagination. |
| `app/admin/login/page.tsx` | Admin login screen. |
| `app/api/admin/login/route.ts` | Password verification and session-cookie creation. |
| `app/api/admin/logout/route.ts` | Same-origin logout and cookie removal. |
| `lib/session.ts`, `lib/auth.ts` | Signed session creation, verification and server-side access checks. |

## Request and access model

```text
Planner + form → POST /api/enquiry → validation + rate limit → PostgreSQL
Password → POST /api/admin/login → signed cookie → /admin → authorized query
```

- The form sends name, email, project details and planner choices. The server trims and validates text, checks allowed option values, rejects unexpected fields and enforces a 20 KB request-body limit. It returns success only after storage succeeds.
- Each submission has a UUID. An identical retry receives success without creating another record; reusing the UUID with different content is rejected. This handles the common case where a database write succeeds but its response is lost.
- Row Level Security is enabled. In Supabase, anonymous and authenticated browser roles have no direct table access; its server secret bypasses RLS. Direct PostgreSQL uses a restricted server login with explicit SELECT/INSERT policies. Both paths require server authorization before an admin query. `/admin` performs that check before constructing its database client.
- Login compares fixed-length password digests with `timingSafeEqual`. Successful login creates an eight-hour signed JWT in an `HttpOnly`, `SameSite=Strict` cookie. Production cookies use `Secure` and the `__Host-` prefix. Authenticated pages and API responses are not intended for shared caching.
- This is one shared administrator identity, not an account-management system. Logout clears that browser's cookie; because sessions are stateless, a copied token can remain valid until expiry. Rotating either `ADMIN_PASSWORD` or `SESSION_SECRET`, then redeploying, invalidates existing tokens. Rotating the session secret also changes rate-limit bucket identifiers.

### Origin configuration

`APP_ORIGIN` permits **one exact origin**: scheme, hostname and port. For production, use the canonical HTTPS origin without a path, query or wildcard, for example `https://your-project.vercel.app`. A POST with a missing or different `Origin` is rejected, including a request from an alternate hostname.

Configure Preview separately from Production. For previews, use a stable branch URL or set `APP_ORIGIN` to the preview URL that you will actually visit and redeploy. Do not leave a production origin on a preview deployment and expect its forms to work. Do not replace the configured origin check with trust in an incoming `Host` header.

### Rate limits

The database applies fixed 15-minute windows: **5 validated enquiry attempts** and **10 login attempts** per client and purpose. Retries count toward the limit. The SQL upsert is atomic across serverless instances; unavailable rate-limit storage returns an error instead of accepting the request.

On Vercel, the implementation uses `x-vercel-forwarded-for` only when the platform's `VERCEL=1` environment flag is present. It HMACs the IP address before storing the bucket key. [Vercel header reference](https://vercel.com/docs/headers/request-headers)

Elsewhere, including local development, requests share a conservative unknown-client bucket. Do not manually set `VERCEL=1` on another host. For another platform, adapt `lib/rate-limit.ts` to its documented, trusted client-IP mechanism before public deployment. Merely trusting a caller-supplied forwarded header lets callers evade the limit.

## Verify

```bash
npm run test
npm run typecheck
npm run build
```

Tests cover validation, request boundaries, duplicate submissions, failure responses, rate-limit behaviour and session verification. Database calls in endpoint tests are mocked. These commands are verification instructions, not a claim that they have already passed in your environment.

After configuring a real Supabase project, verify the deployed path manually:

1. Submit a valid form and confirm exactly one row appears in Supabase and `/admin`.
2. Confirm invalid email, short project details and unsupported planner values are rejected.
3. Check that an incognito visitor cannot view submissions, an incorrect password fails, and logout returns the admin page to login.
4. Confirm anonymous direct database reads/writes are denied and requests from another origin are rejected.
5. Exercise narrow mobile, tablet and desktop layouts; use the keyboard to select planner choices and submit the form.
6. Confirm failure feedback preserves entered text and never reports a failed database write as successful.

**A live Supabase insert/read round trip has not been verified in the supplied environment.** Run the SQL and the checks above using your own project before assessment or publication.

## Deploy on Vercel

1. Push the source and lockfile to a Git repository, keeping `.env.local` excluded.
2. Import the repository into Vercel and select the Next.js preset with a supported Node.js 22+ runtime.
3. Add all five variables in the appropriate Production/Preview environments. Use HTTPS for deployed origins.
4. Deploy. If you only learn the canonical URL after deployment, set `APP_ORIGIN` and redeploy before testing forms or login.
5. Complete the live form → database → admin verification above. Share the admin password privately with the evaluator, never in a public README or repository.

Vercel Hobby is for personal, noncommercial use; check the plan if this moves from an assignment demo to an agency's commercial production site. Supabase Free projects can pause after a week of inactivity, so check availability before an assessment. [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Supabase pricing](https://supabase.com/pricing)

## Explaining the implementation in an interview

- **Small architecture:** one Next.js application handles the page, server endpoint and admin. Supabase supplies persistent Postgres storage; an ORM would add little for one submission table.
- **Clear client/server boundary:** interactive planner state stays in a Client Component. Validation, secrets, persistence and admin authorization stay on the server.
- **Two layers of validation:** Zod gives field-level errors; SQL constraints preserve basic data integrity even if application code changes.
- **Reliable submission behaviour:** loading/error/success states are explicit, and idempotency protects retries without silently overwriting data.
- **Accessible interaction:** native radio buttons and checkboxes provide expected keyboard behaviour, labels identify fields, and feedback is announced to assistive technology.
- **Deliberate scope:** the admin reads all enquiries through pagination. Email delivery, multiple administrator roles and a revocation database are outside this implementation.
