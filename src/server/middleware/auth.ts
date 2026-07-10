// ---------------------------------------------------------------------------
// Auth middleware (Phase 2).
//
// - authMiddleware: reads the session cookie, resolves the user, and stores it
//   on the context as `user` (User | null). NEVER rejects — public routes exist
//   (customer /book, health). Apply app-wide before routes.
// - requireAuth: guard that throws AUTH_UNAUTHORIZED when no user is present.
// - requireRole(...roles): guard that throws AUTH_FORBIDDEN when the user's role
//   is not in the allow-list (implies auth — also 401s if unauthenticated).
//
// The Planner merges `AuthVariables` into the app's Env `Variables` so `c.get
// ('user')` / `c.set('user', ...)` are typed everywhere.
// ---------------------------------------------------------------------------
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { Context, MiddlewareHandler } from 'hono'
import { getDb } from '../db/client'
import type { User, UserRole } from '../db/schema'
import { AUTH_FORBIDDEN, AUTH_UNAUTHORIZED } from '../lib/errors'
import { COOKIE_NAME } from '../lib/auth'
import { getSessionUser } from '../lib/session'

// Context variables contributed by this middleware. Merge into Env['Variables'].
export type AuthVariables = {
  user: User | null
}

// Env shape this middleware relies on. `createMiddleware` is generic over it so
// c.set('user', ...) type-checks regardless of the concrete app Env.
type AuthEnv = {
  Bindings: { DB: D1Database }
  Variables: AuthVariables
}

/**
 * Populate `c.var.user` from the session cookie. Sets null when absent/invalid.
 * Never short-circuits — downstream guards decide what requires auth.
 */
export const authMiddleware: MiddlewareHandler<AuthEnv> = createMiddleware<AuthEnv>(
  async (c, next) => {
    const token = getCookie(c, COOKIE_NAME)
    if (!token) {
      c.set('user', null)
      return next()
    }
    const db = getDb(c.env.DB)
    const user = await getSessionUser(db, token)
    c.set('user', user)
    return next()
  },
)

/** Throw AUTH_UNAUTHORIZED if there is no authenticated user. */
export function requireAuth(c: Context<AuthEnv>): User {
  const user = c.get('user')
  if (!user) throw AUTH_UNAUTHORIZED()
  return user
}

/**
 * Guard middleware: require an authenticated user whose role is in `roles`.
 * 401 if unauthenticated, 403 if authenticated but role not allowed.
 */
export function requireRole(...roles: UserRole[]): MiddlewareHandler<AuthEnv> {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = requireAuth(c)
    if (!roles.includes(user.role)) {
      throw AUTH_FORBIDDEN(undefined, { context: { role: user.role, required: roles } })
    }
    return next()
  })
}
