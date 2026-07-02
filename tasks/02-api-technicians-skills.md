# Task 02 — API: Technicians + Skills (Phase 1)

**Model/effort:** Sonnet / medium
**Depends on:** 01 (done). Runs parallel with 03,04. Blocks: 06,09,10.

## Goal
CRUD REST endpoints for technicians, skills, and the technician_skills M2M, as a Hono sub-app.

## Key facts (from completed tasks)
- Hono app: `src/server/app.ts` — `export type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } }`. **Do NOT edit app.ts** — the Planner mounts your router. Just export a sub-app.
- DB: `import { getDb } from '../db/client'` → `getDb(c.env.DB)` returns a drizzle instance with `{ schema }`.
- Schema in `src/server/db/schema.ts`: `technicians` (id, name, avatarUrl, active, createdAt), `skills` (id, name unique), `technicianSkills` (technicianId, skillId — composite PK). Inferred types exported (Technician, Skill, etc.).
- Zod is installed.

## Deliverable
Create `src/server/routes/technicians.ts` exporting a Hono sub-app (`const r = new Hono<Env>()`) with:

**Technicians**
- `GET /` — list all technicians, each with its skills array (join technician_skills → skills). Support `?active=true` filter optional.
- `GET /:id` — one technician with skills.
- `POST /` — create; body {name, avatarUrl?, active?, skillIds?: number[]}. Zod-validated. Insert technician, then technician_skills rows for skillIds.
- `PATCH /:id` — update name/avatarUrl/active and (if skillIds provided) replace the skill set.
- `DELETE /:id` — delete (cascade handles technician_skills).

**Skills** — put in the same file OR a `src/server/routes/skills.ts` sub-app (your choice; document it):
- `GET /` list, `POST /` create {name}, `DELETE /:id`.

Intended mount points (Planner will wire): technicians → `/api/technicians`, skills → `/api/skills`. So define routes relative to `/` (e.g. `r.get('/', ...)`).

## Conventions
- Validate all bodies with Zod; return 400 with `{error}` on invalid, 404 when not found.
- Return JSON. Use proper status codes (201 on create).
- Reuse drizzle relational queries (`db.query.technicians.findMany({ with: { technicianSkills: { with: { skill: true } } } })`) — flatten skills into a clean `skills: [{id,name}]` shape in the response so the frontend doesn't see the join table.

## Constraints
- Only create files under `src/server/routes/`. Do NOT edit `app.ts`, `src/client`, schema, or seed.
- No auth (PRD non-goal).

## Verify before done
- `npx tsc --noEmit -p tsconfig.server.json` clean.
- Temporarily mount your router in a scratch test OR reason through the drizzle query shapes; at minimum typecheck must pass. (Planner will do the live HTTP smoke test after mounting.)
- Report: exact file(s) created, the export name(s), intended mount paths, and the response JSON shape for `GET /technicians`.

## Checklist
- [ ] routes/technicians.ts sub-app exported
- [ ] skills endpoints (same or separate file — documented)
- [ ] GET list + GET :id return technician with flattened skills[]
- [ ] POST/PATCH handle skillIds (replace set)
- [ ] DELETE works (cascade)
- [ ] Zod validation + 400/404 handling
- [ ] tsc clean
- [ ] reported files/exports/mount paths/response shape
