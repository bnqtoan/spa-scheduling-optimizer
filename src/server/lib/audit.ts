// ---------------------------------------------------------------------------
// Audit trail (Phase 2). One append-only row per booking mutation recording
// WHO did WHAT and the old→new values (#2 #5).
//
// Ordering decision: writeAudit runs AFTER the main mutation has committed
// (create/cancel/update/pay), in the same request flow but best-effort. If the
// audit insert fails we log it via logStructured (Task 14) and swallow the
// error — the user-facing mutation has already succeeded and must not be
// rolled back or reported as failed just because the audit row didn't land.
// The audit trail is observability, never a gate on the business operation.
//
// Exported for reuse by Task 17 (writeAudit for the 'pay' action).
// ---------------------------------------------------------------------------
import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { auditLog, users, type AuditAction } from '../db/schema'
import { logStructured } from './errors'

export interface WriteAuditParams {
  bookingId: number
  userId: number | null // null = customer self-service
  action: AuditAction
  oldValues?: unknown
  newValues?: unknown
}

/**
 * Serialize a value for the audit row. undefined → null (column stays empty);
 * everything else → JSON.stringify. Kept pure + exported for unit testing.
 */
export function serializeAuditValue(value: unknown): string | null {
  if (value === undefined) return null
  return JSON.stringify(value)
}

/**
 * Insert one audit_log row. Best-effort: on any DB error, log via logStructured
 * and return without throwing so the caller's already-committed mutation still
 * succeeds. Call AFTER the mutation.
 */
export async function writeAudit(db: Db, params: WriteAuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      bookingId: params.bookingId,
      userId: params.userId,
      action: params.action,
      oldValues: serializeAuditValue(params.oldValues),
      newValues: serializeAuditValue(params.newValues),
    })
  } catch (err) {
    logStructured('ERROR', {
      category: 'DB',
      code: 'AUDIT_WRITE_FAILED',
      message: 'failed to write audit_log row',
      context: {
        bookingId: params.bookingId,
        userId: params.userId,
        action: params.action,
        error: String(err),
      },
    })
  }
}

/**
 * List audit rows for a booking, newest first, joined with the acting username.
 * Backs the admin "who did what" view (#2).
 */
export async function listAuditForBooking(db: Db, bookingId: number) {
  return db
    .select({
      id: auditLog.id,
      bookingId: auditLog.bookingId,
      userId: auditLog.userId,
      username: users.username,
      action: auditLog.action,
      oldValues: auditLog.oldValues,
      newValues: auditLog.newValues,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(and(eq(auditLog.bookingId, bookingId)))
    .orderBy(desc(auditLog.id))
}
