# Task 03 — API: Services (Phase 1)

**Model/effort:** Sonnet / medium
**Depends on:** 01 (done). Runs parallel with 02,04. Blocks: 06,09,10.

## Goal
CRUD REST endpoints for services, as a Hono sub-app.

## Key facts
- Hono app: `src/server/app.ts` — `Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } }`. **Do NOT edit app.ts** — Planner mounts your router.
- DB: `import { getDb } from '../db/client'` → `getDb(c.env.DB)`.
- Schema `src/server/db/schema.ts`: `services` (id, name, skillId → required skill fk, durationMin, price [VND int], active). Relation `services.skill`. Types: Service, NewService.
- Zod installed.

## Deliverable
Create `src/server/routes/services.ts` exporting a Hono sub-app with routes relative to `/` (Planner mounts at `/api/services`):
- `GET /` — list services, each with its skill `{id,name}` joined. Optional `?active=true` and `?skillId=` filters.
- `GET /:id` — one service with skill.
- `POST /` — create; body {name, skillId, durationMin, price, active?}. Zod: durationMin>0, price>=0, skillId exists (or just fk-trust + 400 on failure).
- `PATCH /:id` — partial update.
- `DELETE /:id` — delete. (Note: bookings reference services; a hard delete may fail fk. Prefer soft-delete via active=false OR return 409 if bookings exist — your call, document it.)

## Conventions
- Zod-validate bodies; 400 on invalid, 404 not found, 201 on create.
- Flatten skill into `skill: {id,name}` in responses.

## Constraints
- Only create files under `src/server/routes/`. Do NOT touch app.ts, src/client, schema, seed, or other route files (agents 02/04 run in parallel).

## Verify before done
- `npx tsc --noEmit -p tsconfig.server.json` clean.
- Report: file created, export name, mount path, `GET /services` response shape, and the delete-vs-softdelete decision.

## Checklist
- [ ] routes/services.ts sub-app exported
- [ ] GET list (+ filters) with joined skill
- [ ] GET :id
- [ ] POST/PATCH with Zod (durationMin>0, price>=0)
- [ ] DELETE (or soft-delete) with fk handling documented
- [ ] 400/404/201 handling
- [ ] tsc clean
- [ ] reported file/export/mount/shape/decision
