// ---------------------------------------------------------------------------
// GET /api/slots/suggest — the slot-suggestion endpoint (Task 06).
//
// This handler does ONLY DB loading + shaping, then delegates all ranking to
// the pure `suggestSlots()` engine in lib/suggest.ts (unit-tested, DB-free).
//
// Per candidate technician it computes free intervals with the SAME building
// blocks the bookings route uses (subtractIntervals of working hours minus
// time-off and non-cancelled bookings), then feeds the engine.
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../app'
import { getDb } from '../db/client'
import {
  bookings,
  services,
  technicians,
  technicianSkills,
  timeOff,
  workingHours,
} from '../db/schema'
import { subtractIntervals, weekdayOf, type Interval } from '../lib/slots'
import { suggestSlots, type TechAvailability } from '../lib/suggest'

const app = new Hono<Env>()

// ---------------------------------------------------------------------------
// Query validation. from < to, valid date, positive ids, sane limit.
// ---------------------------------------------------------------------------
const suggestQuerySchema = z
  .object({
    serviceId: z.coerce.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be yyyy-mm-dd'),
    from: z.coerce.number().int().min(0).max(1440),
    to: z.coerce.number().int().min(0).max(1440),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .refine((q) => q.from < q.to, { message: 'from must be less than to', path: ['from'] })

// ---------------------------------------------------------------------------
// GET /suggest?serviceId=&date=&from=&to=&limit=
// ---------------------------------------------------------------------------
app.get('/suggest', async (c) => {
  const parsed = suggestQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'invalid query', issues: parsed.error.issues }, 400)
  }
  const { serviceId, date, from, to } = parsed.data
  const limit = parsed.data.limit ?? 5

  const db = getDb(c.env.DB)

  // 1) Load the service -> durationMin, skillId. 404 if missing.
  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1)
  if (!service) {
    return c.json({ error: 'service not found', code: 'service_not_found' }, 404)
  }

  const weekday = weekdayOf(date)

  // 2) Candidate technicians: have the required skill AND are active.
  const candidates = await db
    .select({ id: technicians.id, name: technicians.name })
    .from(technicians)
    .innerJoin(technicianSkills, eq(technicianSkills.technicianId, technicians.id))
    .where(and(eq(technicianSkills.skillId, service.skillId), eq(technicians.active, true)))

  const candidateIds = candidates.map((t) => t.id)

  // Short-circuit: no qualified techs -> empty result (still 200 with the shape).
  if (candidateIds.length === 0) {
    return c.json({
      service: { id: service.id, name: service.name, durationMin: service.durationMin },
      slots: [],
    })
  }

  // 3) Bulk-load the day's data for all candidates in three queries.
  const hoursRows = await db
    .select()
    .from(workingHours)
    .where(
      and(eq(workingHours.weekday, weekday), inArray(workingHours.technicianId, candidateIds)),
    )

  const offRows = await db
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.date, date), inArray(timeOff.technicianId, candidateIds)))

  const bookingRows = await db
    .select({
      technicianId: bookings.technicianId,
      startMin: bookings.startMin,
      endMin: bookings.endMin,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.date, date),
        ne(bookings.status, 'cancelled'),
        inArray(bookings.technicianId, candidateIds),
      ),
    )

  // Index the loaded rows by technician for O(1) per-tech assembly.
  const hoursByTech = new Map<number, Interval[]>()
  for (const h of hoursRows) {
    const list = hoursByTech.get(h.technicianId) ?? []
    list.push({ start: h.startMin, end: h.endMin })
    hoursByTech.set(h.technicianId, list)
  }

  const offsByTech = new Map<number, typeof offRows>()
  for (const o of offRows) {
    const list = offsByTech.get(o.technicianId) ?? []
    list.push(o)
    offsByTech.set(o.technicianId, list)
  }

  const bookingsByTech = new Map<number, Interval[]>()
  for (const b of bookingRows) {
    const list = bookingsByTech.get(b.technicianId) ?? []
    list.push({ start: b.startMin, end: b.endMin })
    bookingsByTech.set(b.technicianId, list)
  }

  // 4) Build per-tech availability for the engine.
  const availability: TechAvailability[] = []
  for (const t of candidates) {
    const hours = hoursByTech.get(t.id) ?? []
    if (hours.length === 0) continue // not working that weekday -> unavailable

    const offs = offsByTech.get(t.id) ?? []
    const techBookings = bookingsByTech.get(t.id) ?? []

    // Free intervals = each working-hours interval minus (time-off + bookings).
    // A whole-day time-off (null start/end) blocks the entire working interval.
    const freeIntervals: Interval[] = []
    for (const wh of hours) {
      const blocks: Interval[] = []
      for (const o of offs) {
        if (o.startMin == null || o.endMin == null) {
          blocks.push({ start: wh.start, end: wh.end }) // whole day off
        } else {
          blocks.push({ start: o.startMin, end: o.endMin })
        }
      }
      for (const b of techBookings) blocks.push(b)
      freeIntervals.push(...subtractIntervals(wh, blocks))
    }

    availability.push({
      technicianId: t.id,
      technicianName: t.name,
      freeIntervals,
      bookingCount: techBookings.length,
    })
  }

  // 5) Rank (pure).
  const ranked = suggestSlots({
    durationMin: service.durationMin,
    from,
    to,
    technicians: availability,
    limit,
  })

  return c.json({
    service: { id: service.id, name: service.name, durationMin: service.durationMin },
    slots: ranked.map((s) => ({
      technicianId: s.technicianId,
      technicianName: s.technicianName,
      startMin: s.startMin,
      endMin: s.endMin,
      score: s.score,
      breakdown: {
        proximity: s.breakdown.proximity,
        load: s.breakdown.load,
        gap: s.breakdown.gap,
      },
    })),
  })
})

export default app
