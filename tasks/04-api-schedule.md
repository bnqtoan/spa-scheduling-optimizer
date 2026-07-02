# Task 04 — API: Schedule (working_hours + time_off) (Phase 1)

**Model/effort:** Sonnet / medium
**Depends on:** 01 (done). Runs parallel with 02,03. Blocks: 09.

## Goal
Endpoints for technician working hours and time off, as a Hono sub-app.

## Key facts
- Hono app: `src/server/app.ts` — `Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } }`. **Do NOT edit app.ts** — Planner mounts your router.
- DB: `import { getDb } from '../db/client'` → `getDb(c.env.DB)`.
- Schema `src/server/db/schema.ts`:
  - `workingHours` (id, technicianId, weekday [0-6, 0=Sunday], startMin, endMin) — minutes from midnight.
  - `timeOff` (id, technicianId, date [ISO yyyy-mm-dd], startMin nullable, endMin nullable [null/null = whole day], reason nullable).
  - Types: WorkingHours, NewWorkingHours, TimeOff, NewTimeOff.
- Zod installed.

## Deliverable
Create `src/server/routes/schedule.ts` exporting a Hono sub-app. Routes relative to `/` (Planner mounts at `/api/schedule`):

**Working hours**
- `GET /working-hours?technicianId=` — list (filter by tech). 
- `PUT /working-hours/:technicianId` — replace the whole weekly schedule for a tech; body: array of {weekday, startMin, endMin}. (Simplest correct model: delete existing rows for tech, insert new set, in sequence.) Zod: 0<=weekday<=6, 0<=startMin<endMin<=1440.
- (Optional) `POST` / `DELETE /working-hours/:id` for single-row edits — nice to have.

**Time off**
- `GET /time-off?technicianId=&from=&to=` — list, optional filters by tech and date range.
- `POST /time-off` — body {technicianId, date, startMin?, endMin?, reason?}. Zod: date is yyyy-mm-dd; if one of startMin/endMin given both must be given and startMin<endMin.
- `DELETE /time-off/:id`.

## Conventions
- Zod-validate; 400 invalid, 404 not found, 201 create.
- Return minutes as-is (frontend formats to HH:MM).

## Constraints
- Only create files under `src/server/routes/`. Do NOT touch app.ts, src/client, schema, seed, or other route files (02/03 run in parallel).

## Verify before done
- `npx tsc --noEmit -p tsconfig.server.json` clean.
- Report: file created, export name, mount path, and the endpoint list with request/response shapes.

## Checklist
- [ ] routes/schedule.ts sub-app exported
- [ ] GET working-hours (by tech)
- [ ] PUT working-hours/:technicianId (replace weekly set)
- [ ] GET time-off (filters)
- [ ] POST time-off (whole-day or partial)
- [ ] DELETE time-off/:id
- [ ] Zod validation (weekday/min ranges, date format)
- [ ] tsc clean
- [ ] reported endpoints + shapes
