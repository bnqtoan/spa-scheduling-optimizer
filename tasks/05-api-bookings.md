# Task 05 — API: Bookings (correctness-critical) (Phase 1)

**Model/effort:** Opus / high
**Depends on:** 01 (done). Runs parallel with 02,03,04,08. Blocks: 06,08(data),11.

## Goal
Bookings endpoints with a hard **no-double-booking** guarantee, plus a small shared library of pure time-interval helpers that Task 06 (slot-suggestion) will reuse.

## Key facts
- Hono app: `src/server/app.ts` — `Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } }`. **Do NOT edit app.ts** — Planner mounts your router.
- DB: `import { getDb } from '../db/client'` → `getDb(c.env.DB)`.
- Schema `src/server/db/schema.ts`:
  - `bookings` (id, code unique "SPA{yymmdd}-{seq}", technicianId, serviceId, customerName, customerPhone, note?, date [yyyy-mm-dd], startMin, endMin, status [scheduled|completed|cancelled] default scheduled, createdAt). `bookingStatusValues` exported.
  - `services` (durationMin, skillId...), `workingHours` (weekday 0=Sun, startMin, endMin), `timeOff` (date, startMin?, endMin?), `technicianSkills`.
  - Relations wired; types exported.
- Zod installed. Times = minutes-from-midnight. Weekday 0=Sunday.

## Deliverable A — shared helpers: `src/server/lib/slots.ts`
Pure, dependency-free, unit-testable functions (Task 06 imports these — design the API cleanly):
- `type Interval = { start: number; end: number }` (minutes).
- `overlaps(a: Interval, b: Interval): boolean` — half-open [start,end) overlap test.
- `weekdayOf(dateISO: string): number` — 0=Sunday..6=Saturday, from a yyyy-mm-dd string (compute in UTC to avoid TZ drift; document the assumption).
- `subtractIntervals(base: Interval, blocks: Interval[]): Interval[]` — free intervals within `base` after removing all `blocks` (used by slot-suggestion).
- Keep these PURE (no db, no I/O).

## Deliverable B — `src/server/routes/bookings.ts` (Hono sub-app, routes relative to `/`, mounted at `/api/bookings`)
- `GET /?date=&technicianId=&status=` — list bookings, filterable. Include joined technician{id,name} and service{id,name,durationMin} for the timeline. Default excludes cancelled unless status given.
- `GET /:id` — one booking with joins.
- `POST /` — create booking. Body {technicianId, serviceId, date, startMin, customerName, customerPhone, note?}. **endMin is derived** = startMin + service.durationMin (do NOT trust a client endMin). Then **server-side re-validate before insert**:
  1. Technician has the service's required skill (technician_skills covers services.skillId) → else 422.
  2. [startMin,endMin) fits within the tech's working_hours for that weekday → else 422.
  3. Not overlapping any time_off for that tech/date → else 422.
  4. Not overlapping any existing non-cancelled booking for that tech/date → else **409 Conflict** (this is the double-book guard).
  Generate `code` = `SPA{yymmdd}-{seq}` where seq is the day's booking count+1 zero-padded to 4 (e.g. SPA260702-0008). Ensure uniqueness (retry/increment if collision). Return 201 with the created booking.
- `PATCH /:id` — allow status change (e.g. → completed / cancelled). If rescheduling (date/start/tech change) is supported, re-run the same validation. Cancelling frees the slot.
- `DELETE /:id` — hard delete OR treat as cancel (document choice; cancel is safer).

## Correctness notes
- Do all read-validate-write for POST within one handler; D1 has no long transactions across statements but re-check overlap immediately before insert to minimize the race window. Use half-open intervals consistently.
- Reuse `overlaps` / `weekdayOf` from lib/slots.ts — do not reimplement.

## Constraints
- Only create `src/server/routes/bookings.ts` and `src/server/lib/slots.ts`. Do NOT touch app.ts, src/client, schema, seed, or other route files (02/03/04 run in parallel).
- No auth.

## Verify before done
- `npx tsc --noEmit -p tsconfig.server.json` clean.
- Add a Vitest unit test `src/server/lib/slots.test.ts` for overlaps / subtractIntervals / weekdayOf (pure functions — must be green). Run `npm test`.
- Reason through the POST validation order; describe how the double-book 409 is guaranteed.
- Report: files created, exact validation order + status codes, code-generation scheme, and the lib/slots.ts function signatures (Task 06 depends on these).

## Checklist
- [ ] lib/slots.ts: Interval, overlaps, weekdayOf, subtractIntervals (pure)
- [ ] lib/slots.test.ts green
- [ ] routes/bookings.ts sub-app exported
- [ ] GET list (+filters, joins) excl. cancelled by default
- [ ] GET :id
- [ ] POST derives endMin, 4-step validation (skill/hours/timeoff/overlap), 409 on double-book, code gen
- [ ] PATCH status/cancel; reschedule re-validates
- [ ] DELETE (cancel vs hard — documented)
- [ ] tsc clean, npm test green
- [ ] reported files/validation/codes/signatures
