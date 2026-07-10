// ---------------------------------------------------------------------------
// Auth routes (Phase 2) — mounted at /api/auth by the Planner.
//   POST /login  — verify credentials, create session, set HttpOnly cookie.
//   POST /logout — delete session, clear cookie.
//   GET  /me     — return the current user (from authMiddleware context).
//
// Public-safe user shape: NEVER returns passwordHash.
// ---------------------------------------------------------------------------
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../app'
import { getDb } from '../db/client'
import { users, type User } from '../db/schema'
import { AUTH_UNAUTHORIZED } from '../lib/errors'
import { COOKIE_NAME, SESSION_TTL_SECONDS, verifyPassword } from '../lib/auth'
import { createSession, deleteSession } from '../lib/session'
import type { AuthVariables } from '../middleware/auth'

// Local Env that guarantees the `user` context var (merged app-wide by Planner).
type AuthEnv = Env & { Variables: AuthVariables }

const app = new Hono<AuthEnv>()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

// Public projection — id/username/role/technicianId only, never the hash.
function publicUser(u: User) {
  return { id: u.id, username: u.username, role: u.role, technicianId: u.technicianId }
}

// Cookie flags: HttpOnly + SameSite=Lax + Path=/. Secure only over HTTPS so
// local http dev still works. Max-Age matches the session TTL.
function sessionCookieOpts(c: { req: { url: string } }) {
  const secure = new URL(c.req.url).protocol === 'https:'
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    path: '/',
    secure,
    maxAge: SESSION_TTL_SECONDS,
  }
}

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400)
  }
  const { username, password } = parsed.data
  const db = getDb(c.env.DB)

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), eq(users.active, true)))
    .limit(1)

  // Uniform failure for unknown user OR bad password (no user-enumeration).
  const ok = user ? await verifyPassword(password, user.passwordHash) : false
  if (!user || !ok) {
    throw AUTH_UNAUTHORIZED('invalid username or password')
  }

  const token = await createSession(db, user.id)
  setCookie(c, COOKIE_NAME, token, sessionCookieOpts(c))
  return c.json({ user: publicUser(user) })
})

// ---------------------------------------------------------------------------
// POST /logout — idempotent; clears cookie + deletes session if present.
// ---------------------------------------------------------------------------
app.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE_NAME)
  if (token) {
    const db = getDb(c.env.DB)
    await deleteSession(db, token)
  }
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// GET /me — current authenticated user, or 401.
// ---------------------------------------------------------------------------
app.get('/me', (c) => {
  const user = c.get('user')
  if (!user) throw AUTH_UNAUTHORIZED()
  return c.json({ user: publicUser(user) })
})

export default app
