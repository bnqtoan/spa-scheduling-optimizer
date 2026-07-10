# Task 15 — Auth: password hashing, sessions, login/logout, middleware (Phase 2) (#3 foundation)

**Model/effort:** Opus / high
**Depends on:** 13 (users/sessions tables), 14 (AppError). Blocks: 16 (RBAC), 19 (login UI).

## Goal
Lightweight session auth on Cloudflare Worker using Web Crypto only (NO heavy libs). Provide password hashing/verify, an opaque-token session store in D1, login/logout endpoints, and a Hono middleware that populates the authenticated user on the context. This is the foundation for RBAC (Task 16) and KTV "my schedule" (#3).

## Key facts
- Env: `src/server/app.ts` `Env = { Bindings: { DB, ASSETS } }`. Add to Env `Variables` a typed `user` (the authed user or null) — coordinate with Planner; you may extend the `Env` type's `Variables` field.
- DB client: `getDb(c.env.DB)`. Tables `users`, `sessions` from Task 13. Session token = opaque random string; store hashed-or-plain? → store the RAW token as `sessions.id` is acceptable for this app (single-tenant, no PRD security mandate); document the choice.
- Use `crypto.subtle` (PBKDF2, SHA-256, ~100k iterations, random salt) for password hashing. Format the stored hash as `pbkdf2$<iterations>$<saltB64>$<hashB64>` so verify is self-describing.

## Deliverables
1. **`src/server/lib/auth.ts`** (pure-ish, Web Crypto):
   - `hashPassword(plain): Promise<string>` → `pbkdf2$...` string.
   - `verifyPassword(plain, stored): Promise<boolean>` (constant-time compare of derived bits).
   - `generateSessionToken(): string` (crypto.getRandomValues → base64url, ≥32 bytes).
   - `SESSION_TTL_SECONDS` constant (e.g. 7 days).
   - `COOKIE_NAME = 'spa_session'`.
2. **`src/server/lib/session.ts`** (DB-touching helpers):
   - `createSession(db, userId)` → inserts row (id, userId, expiresAt=now+TTL), returns token.
   - `getSessionUser(db, token)` → joins sessions→users, returns user or null if missing/expired. Cleans up nothing (lazy).
   - `deleteSession(db, token)`.
   - NOTE: `now` — Workers have Date; use `Math.floor(Date.now()/1000)`.
3. **`src/server/routes/auth.ts`** (Hono sub-app, mounted at `/api/auth` by Planner — DO NOT edit app.ts mount):
   - `POST /login` — body `{username, password}` (Zod). Look up active user, `verifyPassword`; on fail throw `AUTH_UNAUTHORIZED`. On success create session, set HTTP-only cookie (`Set-Cookie: spa_session=...; HttpOnly; Path=/; SameSite=Lax; Max-Age=...; Secure` — Secure in prod). Return `{ user: { id, username, role, technicianId } }` (never the hash).
   - `POST /logout` — read cookie, deleteSession, clear cookie. 200.
   - `GET /me` — return current user from context (or 401 via AUTH_UNAUTHORIZED).
4. **`src/server/middleware/auth.ts`**:
   - `authMiddleware` — reads cookie, `getSessionUser`, sets `c.set('user', user)` (or null). Does NOT reject (public routes exist). Planner applies it app-wide before routes.
   - `requireAuth` — throws `AUTH_UNAUTHORIZED` if no user. (Used by protected routers.)
   - `requireRole(...roles)` — throws `AUTH_FORBIDDEN` if user role not in list.

## Seed hash coordination (Task 13)
Task 13 left a placeholder hash for password `spa123`. Provide the real PBKDF2 hash: run `hashPassword('spa123')` once and put the resulting string into seed.sql for all 7 users (you MAY edit seed.sql for THIS one purpose — the hash strings only). If salt is random per call, either use the same hash for all (fine) or note that each user can share one precomputed hash string. Document the exact string used.

## Tests — REQUIRED (`src/server/lib/auth.test.ts`)
- hash then verify round-trips true; wrong password → false; tampered hash → false; token is unique/long; hash format parses.

## Constraints
- Create auth.ts, session.ts, routes/auth.ts, middleware/auth.ts, auth.test.ts. Edit seed.sql ONLY for the real password hash. Extend Env `Variables` type if needed (coordinate).
- DO NOT edit app.ts mounts (Planner mounts `/api/auth` + applies authMiddleware). DO NOT touch client.

## Verify before done
- tsc server clean; `npm test` green.
- Live smoke: `POST /api/auth/login {username:'admin',password:'spa123'}` → 200 + Set-Cookie; `GET /api/auth/me` with cookie → the user; wrong password → 401 `AUTH_UNAUTHORIZED`; logout clears session.
- Report: hashing scheme + stored format, the seed hash string, cookie flags, and the middleware API (requireAuth/requireRole signatures) for Task 16.

## Checklist
- [ ] lib/auth.ts (hash/verify PBKDF2, token gen, constants)
- [ ] lib/session.ts (create/get/delete session in D1)
- [ ] routes/auth.ts (login/logout/me) with HTTP-only cookie
- [ ] middleware/auth.ts (authMiddleware, requireAuth, requireRole)
- [ ] seed.sql real spa123 hash filled; auth.test.ts green; tsc clean; live login/me/logout smoke passes
