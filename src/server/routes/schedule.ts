import { Hono } from 'hono'
import { and, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/client'
import { timeOff, workingHours } from '../db/schema'
import type { Env } from '../app'

const app = new Hono<Env>()

// ---------------------------------------------------------------------------
// schemas
// ---------------------------------------------------------------------------
const workingHourEntrySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMin: z.number().int().min(0),
    endMin: z.number().int().max(1440),
  })
  .refine((v) => v.startMin < v.endMin, {
    message: 'startMin must be < endMin',
    path: ['startMin'],
  })

const replaceWorkingHoursSchema = z.array(workingHourEntrySchema)

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be yyyy-mm-dd')

const createTimeOffSchema = z
  .object({
    technicianId: z.number().int(),
    date: dateSchema,
    startMin: z.number().int().min(0).max(1440).optional(),
    endMin: z.number().int().min(0).max(1440).optional(),
    reason: z.string().optional(),
  })
  .refine((v) => (v.startMin === undefined) === (v.endMin === undefined), {
    message: 'startMin and endMin must be given together',
    path: ['startMin'],
  })
  .refine((v) => v.startMin === undefined || v.startMin < v.endMin!, {
    message: 'startMin must be < endMin',
    path: ['startMin'],
  })

// ---------------------------------------------------------------------------
// working hours
// ---------------------------------------------------------------------------

// GET /working-hours?technicianId=
app.get('/working-hours', async (c) => {
  const db = getDb(c.env.DB)
  const technicianIdRaw = c.req.query('technicianId')

  if (technicianIdRaw !== undefined) {
    const technicianId = Number(technicianIdRaw)
    if (!Number.isInteger(technicianId)) {
      return c.json({ error: 'technicianId must be an integer' }, 400)
    }
    const rows = await db
      .select()
      .from(workingHours)
      .where(eq(workingHours.technicianId, technicianId))
    return c.json(rows)
  }

  const rows = await db.select().from(workingHours)
  return c.json(rows)
})

// PUT /working-hours/:technicianId — replace the whole weekly schedule
app.put('/working-hours/:technicianId', async (c) => {
  const technicianId = Number(c.req.param('technicianId'))
  if (!Number.isInteger(technicianId)) {
    return c.json({ error: 'technicianId must be an integer' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = replaceWorkingHoursSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', issues: parsed.error.issues }, 400)
  }

  const db = getDb(c.env.DB)

  await db.delete(workingHours).where(eq(workingHours.technicianId, technicianId))

  if (parsed.data.length === 0) {
    return c.json([])
  }

  const inserted = await db
    .insert(workingHours)
    .values(
      parsed.data.map((entry) => ({
        technicianId,
        weekday: entry.weekday,
        startMin: entry.startMin,
        endMin: entry.endMin,
      })),
    )
    .returning()

  return c.json(inserted)
})

// ---------------------------------------------------------------------------
// time off
// ---------------------------------------------------------------------------

// GET /time-off?technicianId=&from=&to=
app.get('/time-off', async (c) => {
  const technicianIdRaw = c.req.query('technicianId')
  const from = c.req.query('from')
  const to = c.req.query('to')

  const conditions = []

  if (technicianIdRaw !== undefined) {
    const technicianId = Number(technicianIdRaw)
    if (!Number.isInteger(technicianId)) {
      return c.json({ error: 'technicianId must be an integer' }, 400)
    }
    conditions.push(eq(timeOff.technicianId, technicianId))
  }

  if (from !== undefined) {
    if (!dateSchema.safeParse(from).success) {
      return c.json({ error: 'from must be yyyy-mm-dd' }, 400)
    }
    conditions.push(gte(timeOff.date, from))
  }

  if (to !== undefined) {
    if (!dateSchema.safeParse(to).success) {
      return c.json({ error: 'to must be yyyy-mm-dd' }, 400)
    }
    conditions.push(lte(timeOff.date, to))
  }

  const db = getDb(c.env.DB)
  const rows = await db
    .select()
    .from(timeOff)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return c.json(rows)
})

// POST /time-off
app.post('/time-off', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createTimeOffSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', issues: parsed.error.issues }, 400)
  }

  const db = getDb(c.env.DB)
  const [created] = await db
    .insert(timeOff)
    .values({
      technicianId: parsed.data.technicianId,
      date: parsed.data.date,
      startMin: parsed.data.startMin ?? null,
      endMin: parsed.data.endMin ?? null,
      reason: parsed.data.reason ?? null,
    })
    .returning()

  return c.json(created, 201)
})

// DELETE /time-off/:id
app.delete('/time-off/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json({ error: 'id must be an integer' }, 400)
  }

  const db = getDb(c.env.DB)
  const deleted = await db.delete(timeOff).where(eq(timeOff.id, id)).returning()

  if (deleted.length === 0) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json({ ok: true })
})

export default app
