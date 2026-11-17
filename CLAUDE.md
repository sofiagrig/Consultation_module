@AGENTS.md

# Project notes

Specialist consultation module for a dental clinic chain. UI is Hebrew, RTL.
See README.md for the product decisions and the approved prototype link.

- Next.js 16: `middleware` is now `src/proxy.ts`; `cookies()` is async.
- Supabase via `@supabase/ssr`: `src/lib/supabase/server.ts` (server) and `client.ts` (browser).
- Auth is shared with the clinic contacts module's Supabase project — never create a separate users table for logins.
- Roles: clinic (branch manager), ops (VP of Operations, screens every request), doctor (specialist), admin (read-only overview).
