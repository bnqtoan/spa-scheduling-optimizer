// ---------------------------------------------------------------------------
// Session store (Phase 2) — DB-touching helpers over the `sessions` table.
//
// Token model: the RAW opaque token IS the `sessions.id` primary key. Chosen
// deliberately for this single-tenant app — the PRD has no security mandate for
// hashing session tokens at rest, and it keeps lookups a single indexed read.
// Sessions carry an absolute `expiresAt` (unix epoch seconds); expiry is checked
// lazily on read (no background cleanup).
// ---------------------------------------------------------------------------
import { and, eq, gt } from 'drizzle-orm'
import type { Db } from '../db/client'
import { sessions, users, type User } from '../db/schema'
import { generateSessionToken, SESSION_TTL_SECONDS } from './auth'

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** Create a session for a user; returns the opaque token to set as a cookie. */
export async function createSession(db: Db, userId: number): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = nowSeconds() + SESSION_TTL_SECONDS
  await db.insert(sessions).values({ id: token, userId, expiresAt })
  return token
}

/**
 * Resolve a session token to its user, or null if the token is missing,
 * unknown, expired, or the user is inactive. Lazy: expired rows are left as-is.
 */
export async function getSessionUser(db: Db, token: string): Promise<User | null> {
  if (!token) return null
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, nowSeconds())))
    .limit(1)
  if (!row) return null
  if (!row.user.active) return null
  return row.user
}

/** Delete a session by token (logout). Idempotent. */
export async function deleteSession(db: Db, token: string): Promise<void> {
  if (!token) return
  await db.delete(sessions).where(eq(sessions.id, token))
}
