import { Hono } from 'hono'
import type { Context } from 'hono'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../app'
import { getDb } from '../db/client'
import { services, skills } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { AUTH_FORBIDDEN } from '../lib/errors'

const app = new Hono<Env>()

// Bridge Context Bindings-invariance (see bookings.ts / Task 15), then enforce
// admin-only for catalog mutations.
function requireAdmin(c: Context<Env, string>) {
  const user = requireAuth(c as unknown as Parameters<typeof requireAuth>[0])
  if (user.role !== 'admin') {
    throw AUTH_FORBIDDEN('admin only', { context: { role: user.role } })
  }
  return user
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function flattenSkill(row: { service: typeof services.$inferSelect; skill: typeof skills.$inferSelect | null }) {
  return {
    ...row.service,
    skill: row.skill ? { id: row.skill.id, name: row.skill.name } : null,
  }
}

const createServiceSchema = z.object({
  name: z.string().min(1),
  skillId: z.number().int().positive(),
  durationMin: z.number().int().positive(),
  price: z.number().int().min(0),
  active: z.boolean().optional(),
})

const updateServiceSchema = createServiceSchema.partial()

const idParamSchema = z.coerce.number().int().positive()

// ---------------------------------------------------------------------------
// GET / — list, optional ?active=true & ?skillId=
// ---------------------------------------------------------------------------
app.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const { active, skillId } = c.req.query()

  const conditions = []
  if (active !== undefined) {
    if (active !== 'true' && active !== 'false') {
      return c.json({ error: 'active must be "true" or "false"' }, 400)
    }
    conditions.push(eq(services.active, active === 'true'))
  }
  if (skillId !== undefined) {
    const parsedSkillId = idParamSchema.safeParse(skillId)
    if (!parsedSkillId.success) {
      return c.json({ error: 'skillId must be a positive integer' }, 400)
    }
    conditions.push(eq(services.skillId, parsedSkillId.data))
  }

  const rows = await db
    .select({ service: services, skill: skills })
    .from(services)
    .leftJoin(skills, eq(services.skillId, skills.id))
    .where(conditions.length ? and(...conditions) : undefined)

  return c.json(rows.map(flattenSkill))
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
  const [row] = await db
    .select({ service: services, skill: skills })
    .from(services)
    .leftJoin(skills, eq(services.skillId, skills.id))
    .where(eq(services.id, parsedId.data))
    .limit(1)

  if (!row) {
    return c.json({ error: 'service not found' }, 404)
  }

  return c.json(flattenSkill(row))
})

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------
app.post('/', async (c) => {
  requireAdmin(c)
  const body = await c.req.json().catch(() => null)
  const parsed = createServiceSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400)
  }

  const db = getDb(c.env.DB)

  // fk-trust with explicit check for a clean 400 instead of a raw D1 fk error
  const [skill] = await db.select().from(skills).where(eq(skills.id, parsed.data.skillId)).limit(1)
  if (!skill) {
    return c.json({ error: 'skillId does not exist' }, 400)
  }

  const [created] = await db
    .insert(services)
    .values({
      name: parsed.data.name,
      skillId: parsed.data.skillId,
      durationMin: parsed.data.durationMin,
      price: parsed.data.price,
      active: parsed.data.active ?? true,
    })
    .returning()

  return c.json(flattenSkill({ service: created, skill }), 201)
})

// ---------------------------------------------------------------------------
// PATCH /:id
// ---------------------------------------------------------------------------
app.patch('/:id', async (c) => {
  requireAdmin(c)
  const parsedId = idParamSchema.safeParse(c.req.param('id'))
  if (!parsedId.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = updateServiceSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400)
  }
  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: 'no fields to update' }, 400)
  }

  const db = getDb(c.env.DB)

  const [existing] = await db.select().from(services).where(eq(services.id, parsedId.data)).limit(1)
  if (!existing) {
    return c.json({ error: 'service not found' }, 404)
  }

  if (parsed.data.skillId !== undefined) {
    const [skill] = await db.select().from(skills).where(eq(skills.id, parsed.data.skillId)).limit(1)
    if (!skill) {
      return c.json({ error: 'skillId does not exist' }, 400)
    }
  }

  const [updated] = await db
    .update(services)
    .set(parsed.data)
    .where(eq(services.id, parsedId.data))
    .returning()

  const [skill] = await db.select().from(skills).where(eq(skills.id, updated.skillId)).limit(1)

  return c.json(flattenSkill({ service: updated, skill: skill ?? null }))
})

// ---------------------------------------------------------------------------
// DELETE /:id — soft-delete (active=false). See decision note below.
//
// Bookings reference services via a required fk (no onDelete cascade/set-null
// configured in schema.ts). A hard delete on a service with existing bookings
// would fail the fk constraint (or, if it succeeded, orphan booking history).
// Since booking history must remain intact for past appointments, DELETE here
// soft-deletes by setting active=false rather than removing the row. This
// keeps `GET /?active=true` (used to populate booking pickers) clean while
// preserving referential integrity and audit history. Calling DELETE twice
// is idempotent (204 both times) as long as the service exists.
// ---------------------------------------------------------------------------
app.delete('/:id', async (c) => {
  requireAdmin(c)
  const parsedId = idParamSchema.safeParse(c.req.param('id'))
  if (!parsedId.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  const db = getDb(c.env.DB)

  const [existing] = await db.select().from(services).where(eq(services.id, parsedId.data)).limit(1)
  if (!existing) {
    return c.json({ error: 'service not found' }, 404)
  }

  await db.update(services).set({ active: false }).where(eq(services.id, parsedId.data))

  return c.body(null, 204)
})

export default app
