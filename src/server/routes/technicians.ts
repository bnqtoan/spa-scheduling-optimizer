import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../app'
import { getDb } from '../db/client'
import { skills, technicianSkills, technicians } from '../db/schema'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const createTechnicianSchema = z.object({
  name: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
  skillIds: z.array(z.number().int()).optional(),
})

const updateTechnicianSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
  skillIds: z.array(z.number().int()).optional(),
})

const createSkillSchema = z.object({
  name: z.string().min(1),
})

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function flattenTechnician(t: {
  id: number
  name: string
  avatarUrl: string | null
  active: boolean
  createdAt: string
  technicianSkills: { skill: { id: number; name: string } }[]
}) {
  const { technicianSkills: ts, ...rest } = t
  return { ...rest, skills: ts.map((row) => row.skill) }
}

// ---------------------------------------------------------------------------
// technicians sub-app — mounted at /api/technicians
// ---------------------------------------------------------------------------
const r = new Hono<Env>()

r.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const activeParam = c.req.query('active')

  const rows = await db.query.technicians.findMany({
    where: activeParam === undefined
      ? undefined
      : (fields, { eq: eqOp }) => eqOp(fields.active, activeParam === 'true'),
    with: {
      technicianSkills: { with: { skill: true } },
    },
    orderBy: (fields, { asc }) => asc(fields.id),
  })

  return c.json(rows.map(flattenTechnician))
})

r.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400)

  const db = getDb(c.env.DB)
  const row = await db.query.technicians.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.id, id),
    with: {
      technicianSkills: { with: { skill: true } },
    },
  })

  if (!row) return c.json({ error: 'Technician not found' }, 404)
  return c.json(flattenTechnician(row))
})

r.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createTechnicianSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)

  const { name, avatarUrl, active, skillIds } = parsed.data
  const db = getDb(c.env.DB)

  const [created] = await db
    .insert(technicians)
    .values({ name, avatarUrl: avatarUrl ?? null, active: active ?? true })
    .returning()

  if (!created) return c.json({ error: 'Failed to create technician' }, 500)

  if (skillIds && skillIds.length > 0) {
    await db
      .insert(technicianSkills)
      .values(skillIds.map((skillId) => ({ technicianId: created.id, skillId })))
  }

  const row = await db.query.technicians.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.id, created.id),
    with: {
      technicianSkills: { with: { skill: true } },
    },
  })

  return c.json(flattenTechnician(row!), 201)
})

r.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400)

  const body = await c.req.json().catch(() => null)
  const parsed = updateTechnicianSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)

  const db = getDb(c.env.DB)

  const existing = await db.query.technicians.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.id, id),
  })
  if (!existing) return c.json({ error: 'Technician not found' }, 404)

  const { name, avatarUrl, active, skillIds } = parsed.data
  const patch: Partial<typeof technicians.$inferInsert> = {}
  if (name !== undefined) patch.name = name
  if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl
  if (active !== undefined) patch.active = active

  if (Object.keys(patch).length > 0) {
    await db.update(technicians).set(patch).where(eq(technicians.id, id))
  }

  if (skillIds !== undefined) {
    await db.delete(technicianSkills).where(eq(technicianSkills.technicianId, id))
    if (skillIds.length > 0) {
      await db
        .insert(technicianSkills)
        .values(skillIds.map((skillId) => ({ technicianId: id, skillId })))
    }
  }

  const row = await db.query.technicians.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.id, id),
    with: {
      technicianSkills: { with: { skill: true } },
    },
  })

  return c.json(flattenTechnician(row!))
})

r.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400)

  const db = getDb(c.env.DB)
  const existing = await db.query.technicians.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.id, id),
  })
  if (!existing) return c.json({ error: 'Technician not found' }, 404)

  await db.delete(technicians).where(eq(technicians.id, id))
  return c.json({ ok: true })
})

export default r

// ---------------------------------------------------------------------------
// skills sub-app — mounted at /api/skills
// ---------------------------------------------------------------------------
export const skillsRoute = new Hono<Env>()

skillsRoute.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.query.skills.findMany({
    orderBy: (fields, { asc }) => asc(fields.id),
  })
  return c.json(rows)
})

skillsRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createSkillSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)

  const db = getDb(c.env.DB)
  const [created] = await db.insert(skills).values({ name: parsed.data.name }).returning()
  return c.json(created, 201)
})

skillsRoute.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400)

  const db = getDb(c.env.DB)
  const existing = await db.query.skills.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.id, id),
  })
  if (!existing) return c.json({ error: 'Skill not found' }, 404)

  await db.delete(skills).where(eq(skills.id, id))
  return c.json({ ok: true })
})
