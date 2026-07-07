import { Hono } from 'hono'
import type { Context } from 'hono'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../app'
import { getDb } from '../db/client'
import {
  bookings,
  bookingStatusValues,
  services,
  technicians,
  technicianSkills,
  timeOff,
  workingHours,
} from '../db/schema'
import { contains, overlaps, weekdayOf, type Interval } from '../lib/slots'
import {
  AUTH_FORBIDDEN,
  BUSINESS_SLOT_OVERLAP,
  VALIDATION_INVALID_INPUT,
  VALIDATION_OUTSIDE_HOURS,
  VALIDATION_SKILL_MISMATCH,
  VALIDATION_TIME_OFF,
} from '../lib/errors'
import { requireAuth, requireRole } from '../middleware/auth'
import { scopeTechnicianId } from '../lib/rbac'
import { listAuditForBooking, writeAudit } from '../lib/audit'

const app = new Hono<Env>()

// requireAuth is typed against the middleware's minimal AuthEnv (Bindings = {DB});
// our app Env additionally has ASSETS and Hono's Context is invariant on
// Bindings, so a direct call doesn't type-check. This thin adapter bridges the
// two without touching the shared middleware (Task 15). Behavior is identical:
// throws AUTH_UNAUTHORIZED if there is no authenticated user.
function currentUser(c: Context<Env, string>) {
  return requireAuth(c as unknown as Parameters<typeof requireAuth>[0])
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const idParamSchema = z.coerce.number().int().positive()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be yyyy-mm-dd')

const createBookingSchema = z.object({
  technicianId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  date: dateSchema,
  startMin: z.number().int().min(0).max(1440),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  note: z.string().optional(),
})

// PATCH: status change and/or reschedule. All fields optional.
const patchBookingSchema = z
  .object({
    status: z.enum(bookingStatusValues).optional(),
    technicianId: z.number().int().positive().optional(),
    serviceId: z.number().int().positive().optional(),
    date: dateSchema.optional(),
    startMin: z.number().int().min(0).max(1440).optional(),
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(1).optional(),
    note: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' })

// A booking joined with its technician + service, for the timeline.
const bookingSelection = {
  booking: bookings,
  technician: { id: technicians.id, name: technicians.name },
  service: { id: services.id, name: services.name, durationMin: services.durationMin },
}

function flatten(row: {
  booking: typeof bookings.$inferSelect
  technician: { id: number; name: string } | null
  service: { id: number; name: string; durationMin: number } | null
}) {
  return {
    ...row.booking,
    technician: row.technician,
    service: row.service,
  }
}

function bookingsWithJoins(db: ReturnType<typeof getDb>) {
  return db
    .select(bookingSelection)
    .from(bookings)
    .leftJoin(technicians, eq(bookings.technicianId, technicians.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
}

// ---------------------------------------------------------------------------
// Core server-side validation, shared by POST (create) and PATCH (reschedule).
//
// Throws an AppError to short-circuit, or returns normally if valid.
// Ordering matters and is intentional (cheap → conflict-critical):
//   1. skill mismatch          -> VALIDATION_SKILL_MISMATCH 422
//   2. outside working hours   -> VALIDATION_OUTSIDE_HOURS   422
//   3. overlaps time_off       -> VALIDATION_TIME_OFF        422
//   4. overlaps a live booking -> BUSINESS_SLOT_OVERLAP      409  (double-book guard)
// `ignoreBookingId` excludes the row being rescheduled from the overlap check.
// AppError is caught by app.onError(appOnError) → standardized JSON + log.
// ---------------------------------------------------------------------------
async function validateSlot(
  db: ReturnType<typeof getDb>,
  input: {
    technicianId: number
    serviceId: number
    date: string
    startMin: number
    endMin: number
  },
  ignoreBookingId?: number,
): Promise<void> {
  const slot: Interval = { start: input.startMin, end: input.endMin }

  // Fetch the service to know the required skill.
  const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1)
  if (!service) {
    throw VALIDATION_INVALID_INPUT('service not found', { context: { serviceId: input.serviceId } })
  }

  // 1) Technician must have the service's required skill.
  const [skillRow] = await db
    .select()
    .from(technicianSkills)
    .where(
      and(
        eq(technicianSkills.technicianId, input.technicianId),
        eq(technicianSkills.skillId, service.skillId),
      ),
    )
    .limit(1)
  if (!skillRow) {
    throw VALIDATION_SKILL_MISMATCH(undefined, {
      context: { technicianId: input.technicianId, skillId: service.skillId },
    })
  }

  // 2) Slot must fit inside the tech's working hours for that weekday.
  const weekday = weekdayOf(input.date)
  const hours = await db
    .select()
    .from(workingHours)
    .where(
      and(eq(workingHours.technicianId, input.technicianId), eq(workingHours.weekday, weekday)),
    )
  const withinHours = hours.some((h) => contains({ start: h.startMin, end: h.endMin }, slot))
  if (!withinHours) {
    throw VALIDATION_OUTSIDE_HOURS(undefined, {
      context: { technicianId: input.technicianId, weekday, slot },
    })
  }

  // 3) Slot must not overlap any time_off for that tech on that date.
  //    A time_off row with null start/end means the whole day is off.
  const offs = await db
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.technicianId, input.technicianId), eq(timeOff.date, input.date)))
  const hitsTimeOff = offs.some((o) => {
    if (o.startMin == null || o.endMin == null) return true // whole day off
    return overlaps(slot, { start: o.startMin, end: o.endMin })
  })
  if (hitsTimeOff) {
    throw VALIDATION_TIME_OFF(undefined, {
      context: { technicianId: input.technicianId, date: input.date },
    })
  }

  // 4) Slot must not overlap any non-cancelled booking for that tech/date.
  //    THE double-book guard. Caller re-runs this immediately before insert.
  const existing = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.technicianId, input.technicianId),
        eq(bookings.date, input.date),
        ne(bookings.status, 'cancelled'),
      ),
    )
  const conflict = existing.some(
    (b) =>
      b.id !== ignoreBookingId && overlaps(slot, { start: b.startMin, end: b.endMin }),
  )
  if (conflict) {
    throw BUSINESS_SLOT_OVERLAP(undefined, {
      context: { technicianId: input.technicianId, date: input.date, slot },
    })
  }
}

// ---------------------------------------------------------------------------
// code generation: SPA{yymmdd}-{seq}, seq = day's booking count + 1, 4 digits.
// Retries with an incremented seq on unique-collision so concurrent inserts on
// the same day don't clash on the code (the day count can lag).
// ---------------------------------------------------------------------------
function codeFor(date: string, seq: number): string {
  const yymmdd = date.slice(2).replace(/-/g, '') // "2026-07-02" -> "260702"
  return `SPA${yymmdd}-${String(seq).padStart(4, '0')}`
}

async function countBookingsOnDate(db: ReturnType<typeof getDb>, date: string): Promise<number> {
  const rows = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.date, date))
  return rows.length
}

// ---------------------------------------------------------------------------
// GET / — list, filterable by ?date=&technicianId=&status=
// Excludes cancelled by default unless an explicit status is requested.
// ---------------------------------------------------------------------------
app.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const { date, technicianId, status } = c.req.query()

  const conditions = []

  if (date !== undefined) {
    if (!dateSchema.safeParse(date).success) {
      return c.json({ error: 'date must be yyyy-mm-dd' }, 400)
    }
    conditions.push(eq(bookings.date, date))
  }

  // Parse any client-requested technician filter, then let RBAC scope it:
  // a technician user is force-restricted to their own technicianId (403 if
  // they request another); admin/receptionist see whatever they ask for.
  let requestedTech: number | undefined
  if (technicianId !== undefined) {
    const parsed = idParamSchema.safeParse(technicianId)
    if (!parsed.success) {
      return c.json({ error: 'technicianId must be a positive integer' }, 400)
    }
    requestedTech = parsed.data
  }
  const scopedTech = scopeTechnicianId(c.get('user'), requestedTech)
  if (scopedTech !== undefined) {
    conditions.push(eq(bookings.technicianId, scopedTech))
  }

  if (status !== undefined) {
    if (!bookingStatusValues.includes(status as (typeof bookingStatusValues)[number])) {
      return c.json({ error: `status must be one of ${bookingStatusValues.join(', ')}` }, 400)
    }
    conditions.push(eq(bookings.status, status as (typeof bookingStatusValues)[number]))
  } else {
    // default: hide cancelled
    conditions.push(ne(bookings.status, 'cancelled'))
  }

  const rows = await bookingsWithJoins(db).where(and(...conditions))
  return c.json(rows.map(flatten))
})

// ---------------------------------------------------------------------------
// GET /:id
// ---------------------------------------------------------------------------
app.get('/:id', async (c) => {
  const parsedId = idParamSchema.safeParse(c.req.param('id'))
  if (!parsedId.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  const db = getDb(c.env.DB)
  const [row] = await bookingsWithJoins(db).where(eq(bookings.id, parsedId.data)).limit(1)
  if (!row) {
    return c.json({ error: 'booking not found' }, 404)
  }
  return c.json(flatten(row))
})

// ---------------------------------------------------------------------------
// POST / — create a booking.
// endMin is DERIVED (startMin + service.durationMin), never trusted from body.
// Runs the 4-step validation, then re-checks overlap immediately before insert
// to minimise the double-book race window (D1 has no multi-statement txn).
// ---------------------------------------------------------------------------
app.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400)
  }
  const input = parsed.data
  const db = getDb(c.env.DB)
  // CREATE is allowed for authed staff (receptionist/admin) AND unauthed
  // customers (PRD self-service /book). Stamp the actor; null = customer.
  const createdByUserId = c.get('user')?.id ?? null

  // Derive endMin from the service duration.
  const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1)
  if (!service) {
    return c.json({ error: 'service not found', code: 'service_not_found' }, 422)
  }
  const endMin = input.startMin + service.durationMin
  if (endMin > 1440) {
    return c.json({ error: 'booking runs past midnight', code: 'past_midnight' }, 422)
  }

  const slotInput = {
    technicianId: input.technicianId,
    serviceId: input.serviceId,
    date: input.date,
    startMin: input.startMin,
    endMin,
  }

  await validateSlot(db, slotInput)

  // Insert with a generated code; re-check overlap right before each attempt
  // and retry on code-collision (increment seq).
  const baseSeq = (await countBookingsOnDate(db, input.date)) + 1
  const MAX_ATTEMPTS = 10

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Final overlap re-check immediately before insert — shrinks the race window.
    await validateSlot(db, slotInput)

    const code = codeFor(input.date, baseSeq + attempt)
    try {
      const [created] = await db
        .insert(bookings)
        .values({
          code,
          technicianId: input.technicianId,
          serviceId: input.serviceId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          note: input.note ?? null,
          date: input.date,
          startMin: input.startMin,
          endMin,
          status: 'scheduled',
          createdByUserId,
        })
        .returning()

      // Audit AFTER a successful insert; best-effort (won't fail the create).
      await writeAudit(db, {
        bookingId: created.id,
        userId: createdByUserId,
        action: 'create',
        newValues: created,
      })

      const [row] = await bookingsWithJoins(db).where(eq(bookings.id, created.id)).limit(1)
      return c.json(row ? flatten(row) : created, 201)
    } catch (err) {
      // Unique collision on code -> retry with next seq. Anything else -> rethrow.
      if (String(err).includes('UNIQUE') || String(err).includes('constraint')) {
        continue
      }
      throw err
    }
  }

  return c.json({ error: 'could not generate a unique booking code', code: 'code_exhausted' }, 500)
})

// ---------------------------------------------------------------------------
// PATCH /:id — status change and/or reschedule.
// A reschedule (date/start/tech/service change) re-runs full validation with
// this booking excluded from the overlap check. Cancelling frees the slot.
// ---------------------------------------------------------------------------
app.patch('/:id', async (c) => {
  // UPDATE/reschedule/status-change is staff-only (receptionist/admin).
  const actor = currentUser(c)
  if (actor.role !== 'admin' && actor.role !== 'receptionist') {
    throw AUTH_FORBIDDEN('only staff may modify bookings', { context: { role: actor.role } })
  }

  const parsedId = idParamSchema.safeParse(c.req.param('id'))
  if (!parsedId.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = patchBookingSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400)
  }
  const patch = parsed.data
  const db = getDb(c.env.DB)

  const [existing] = await db.select().from(bookings).where(eq(bookings.id, parsedId.data)).limit(1)
  if (!existing) {
    return c.json({ error: 'booking not found' }, 404)
  }

  // Determine whether the slot-defining fields change (a reschedule).
  const rescheduling =
    (patch.technicianId !== undefined && patch.technicianId !== existing.technicianId) ||
    (patch.serviceId !== undefined && patch.serviceId !== existing.serviceId) ||
    (patch.date !== undefined && patch.date !== existing.date) ||
    (patch.startMin !== undefined && patch.startMin !== existing.startMin)

  const next = {
    technicianId: patch.technicianId ?? existing.technicianId,
    serviceId: patch.serviceId ?? existing.serviceId,
    date: patch.date ?? existing.date,
    startMin: patch.startMin ?? existing.startMin,
  }

  // Re-derive endMin whenever service or start changes (or any reschedule).
  let endMin = existing.endMin
  if (rescheduling) {
    const [service] = await db.select().from(services).where(eq(services.id, next.serviceId)).limit(1)
    if (!service) {
      return c.json({ error: 'service not found', code: 'service_not_found' }, 422)
    }
    endMin = next.startMin + service.durationMin
    if (endMin > 1440) {
      return c.json({ error: 'booking runs past midnight', code: 'past_midnight' }, 422)
    }

    // Only validate the slot if the (new) status is not cancelled — a cancelled
    // booking occupies nothing.
    const nextStatus = patch.status ?? existing.status
    if (nextStatus !== 'cancelled') {
      await validateSlot(db, { ...next, endMin }, existing.id)
    }
  }

  const updateValues: Partial<typeof bookings.$inferInsert> = {}
  if (patch.status !== undefined) updateValues.status = patch.status
  if (patch.technicianId !== undefined) updateValues.technicianId = patch.technicianId
  if (patch.serviceId !== undefined) updateValues.serviceId = patch.serviceId
  if (patch.date !== undefined) updateValues.date = patch.date
  if (patch.startMin !== undefined) updateValues.startMin = patch.startMin
  if (rescheduling) updateValues.endMin = endMin
  if (patch.customerName !== undefined) updateValues.customerName = patch.customerName
  if (patch.customerPhone !== undefined) updateValues.customerPhone = patch.customerPhone
  if (patch.note !== undefined) updateValues.note = patch.note

  await db.update(bookings).set(updateValues).where(eq(bookings.id, parsedId.data))

  // Audit the change: old = pre-update row, new = the fields we set.
  // A cancel via PATCH(status:'cancelled') records action 'cancel'; any other
  // change records 'update'. Best-effort.
  const isCancel = patch.status === 'cancelled' && existing.status !== 'cancelled'
  await writeAudit(db, {
    bookingId: existing.id,
    userId: actor.id,
    action: isCancel ? 'cancel' : 'update',
    oldValues: existing,
    newValues: updateValues,
  })

  const [row] = await bookingsWithJoins(db).where(eq(bookings.id, parsedId.data)).limit(1)
  return c.json(row ? flatten(row) : existing)
})

// ---------------------------------------------------------------------------
// DELETE /:id — CANCEL (soft), not hard delete.
//
// Decision: cancelling is safer than a hard delete. It (a) preserves booking
// history/audit and the unique code, (b) keeps referential integrity intact,
// and (c) frees the slot for the double-book check (which ignores cancelled
// rows) exactly like a PATCH→cancelled. A hard row delete would destroy the
// audit trail and the day's seq accounting. Cancelling an already-cancelled
// booking is idempotent (200 both times).
// ---------------------------------------------------------------------------
app.delete('/:id', async (c) => {
  // CANCEL is staff-only (receptionist/admin).
  const actor = currentUser(c)
  if (actor.role !== 'admin' && actor.role !== 'receptionist') {
    throw AUTH_FORBIDDEN('only staff may cancel bookings', { context: { role: actor.role } })
  }

  const parsedId = idParamSchema.safeParse(c.req.param('id'))
  if (!parsedId.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  const db = getDb(c.env.DB)
  const [existing] = await db.select().from(bookings).where(eq(bookings.id, parsedId.data)).limit(1)
  if (!existing) {
    return c.json({ error: 'booking not found' }, 404)
  }

  await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, parsedId.data))

  // Audit only a real state change (idempotent re-cancel writes nothing).
  if (existing.status !== 'cancelled') {
    await writeAudit(db, {
      bookingId: existing.id,
      userId: actor.id,
      action: 'cancel',
      oldValues: { status: existing.status },
      newValues: { status: 'cancelled' },
    })
  }
  return c.json({ ok: true, status: 'cancelled' })
})

// ---------------------------------------------------------------------------
// GET /:id/audit — admin-only "who did what" timeline for a booking.
// Newest first (ordered by audit id desc), joined with the acting username.
// ---------------------------------------------------------------------------
app.get('/:id/audit', requireRole('admin'), async (c) => {
  const parsedId = idParamSchema.safeParse(c.req.param('id'))
  if (!parsedId.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  const db = getDb(c.env.DB)
  const rows = await listAuditForBooking(db, parsedId.data)
  return c.json(rows)
})

export default app
