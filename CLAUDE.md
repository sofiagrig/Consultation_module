@AGENTS.md

# Project notes

Specialist consultation module for a dental clinic chain. UI is Hebrew, RTL.
See README.md for the product decisions and the approved prototype link.

- Next.js 16: `middleware` is now `src/proxy.ts`; `cookies()` is async.
- Supabase via `@supabase/ssr`: `src/lib/supabase/server.ts` (server) and `client.ts` (browser).
- Auth is shared with the clinic contacts module's Supabase project — never create a separate users table for logins.
- Roles: clinic (branch manager), ops (VP of Operations, screens every request), doctor (specialist), admin (read-only overview).
- Shared schema lives in sofiagrig/dental-branch-directory (`supabase/migrations`): reuse `profiles` (app_role, branch_id, staff_id), `branches`, `staff`, `specialties`. Login helper `src/lib/auth.ts` is copied from there — keep them identical.
- Consultation tables must be prefixed `consult_` so they never clash with the clinic contacts module.
- Database schema for this module: `supabase/migrations/*_consultation_module.sql` in sofiagrig/dental-branch-directory (tests: `db-tests/consultation_test.sql`). All writes go through `consult_*` RPCs; RLS decides visibility. Add DB changes there as new migrations, never here.
- Before committing: `npm run lint`, `npm run typecheck`, `npm run build` (CI runs the same).
