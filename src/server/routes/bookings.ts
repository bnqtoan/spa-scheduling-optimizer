import { Hono } from 'hono'
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

const app = new Hono<Env>()

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
// Returns an error {status, body} to short-circuit, or null if valid.
// Ordering matters and is intentional (cheap → conflict-critical):
//   1. skill mismatch          -> 422
//   2. outside working hours   -> 422
//   3. overlaps time_off       -> 422
//   4. overlaps a live booking -> 409  (the double-book guard)
// `ignoreBookingId` excludes the row being rescheduled from the overlap check.
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
): Promise<{ status: 422 | 409; body: { error: string; code: string } } | null> {
  const slot: Interval = { start: input.startMin, end: input.endMin }

  // Fetch the service to know the required skill.
  const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1)
  if (!service) {
    return { status: 422, body: { error: 'service not found', code: 'service_not_found' } }
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
    return {
      status: 422,
      body: { error: 'technician lacks the required skill for this service', code: 'skill_mismatch' },
    }
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
    return {
      status: 422,
      body: { error: 'slot is outside the technician working hours', code: 'outside_working_hours' },
    }
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
    return {
      status: 422,
      body: { error: 'slot overlaps the technician time off', code: 'time_off' },
    }
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
    return {
      status: 409,
      body: { error: 'slot overlaps an existing booking', code: 'double_booking' },
    }
  }

  return null
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

  if (technicianId !== undefined) {
    const parsed = idParamSchema.safeParse(technicianId)
    if (!parsed.success) {
      return c.json({ error: 'technicianId must be a positive integer' }, 400)
    }
    conditions.push(eq(bookings.technicianId, parsed.data))
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

  const invalid = await validateSlot(db, slotInput)
  if (invalid) {
    return c.json(invalid.body, invalid.status)
  }

  // Insert with a generated code; re-check overlap right before each attempt
  // and retry on code-collision (increment seq).
  const baseSeq = (await countBookingsOnDate(db, input.date)) + 1
  const MAX_ATTEMPTS = 10

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Final overlap re-check immediately before insert — shrinks the race window.
    const raceCheck = await validateSlot(db, slotInput)
    if (raceCheck) {
      return c.json(raceCheck.body, raceCheck.status)
    }

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
        })
        .returning()

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
      const invalid = await validateSlot(db, { ...next, endMin }, existing.id)
      if (invalid) {
        return c.json(invalid.body, invalid.status)
      }
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
  return c.json({ ok: true, status: 'cancelled' })
})

export default app
