// ---------------------------------------------------------------------------
// RBAC helpers (Phase 2). Pure, DB-free, unit-tested. Route handlers import
// these to enforce role-based visibility without duplicating the logic.
// ---------------------------------------------------------------------------
import type { User } from '../db/schema'
import { AUTH_FORBIDDEN } from './errors'

/**
 * Resolve which technicianId a read (booking list / schedule) should be scoped
 * to, given the acting user and any client-requested technician filter.
 *
 * - role === 'technician': FORCE-scope to the user's own technicianId. If the
 *   client asks for a *different* tech → AUTH_FORBIDDEN (403). Asking for their
 *   own tech (or nothing) is fine.
 * - admin / receptionist / unauthed: pass the requested filter through
 *   unchanged (undefined = no filter = see all).
 *
 * Returns the technicianId to filter by, or undefined for "no restriction".
 */
export function scopeTechnicianId(
  user: User | null,
  requested: number | undefined,
): number | undefined {
  if (user?.role === 'technician') {
    const own = user.technicianId ?? undefined
    if (requested !== undefined && requested !== own) {
      throw AUTH_FORBIDDEN('technicians may only view their own bookings', {
        context: { requested, own },
      })
    }
    return own
  }
  return requested
}
