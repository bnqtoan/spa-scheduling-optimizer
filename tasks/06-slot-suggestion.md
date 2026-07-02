# Task 06 — Slot Suggestion Engine (THE CORE FEATURE) (Phase 1)

**Model/effort:** Opus / high
**Depends on:** 01,02,03,05 (all done). Blocks: 10.

## Goal
Implement the "Suggest Available Slots" engine + `GET /api/slots/suggest` endpoint. This is the most important feature in the PRD. Given a service, a desired date, and a desired time window, return the best available slots across qualified technicians, **scored** and ranked.

## Key facts (all built & verified live)
- Hono app: `src/server/app.ts`, `Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } }`. **DO NOT edit app.ts** — Planner mounts your router at `/api/slots`.
- DB: `import { getDb } from '../db/client'` → `getDb(c.env.DB)`.
- Schema `src/server/db/schema.ts`: services(durationMin, skillId), technicianSkills(technicianId, skillId), workingHours(technicianId, weekday [0=Sun], startMin, endMin), timeOff(technicianId, date, startMin?, endMin? [null=whole day]), bookings(technicianId, date, startMin, endMin, status). Times = minutes-from-midnight, half-open [start,end).
- **Reuse `src/server/lib/slots.ts`** (already written & unit-tested — 20 tests green). Import, do NOT reimplement:
  - `type Interval = { start: number; end: number }`
  - `overlaps(a, b)` — half-open; touching endpoints don't overlap.
  - `contains(outer, inner)` — inner fits inside outer (shared endpoints ok).
  - `weekdayOf(dateISO)` — 0=Sun..6=Sat, UTC-parsed, NaN on malformed.
  - `subtractIntervals(base, blocks)` — sorted non-overlapping free gaps within base after removing blocks. **This is the primary building block.**

## Algorithm (PRD — implement precisely)
Input: `serviceId`, `date` (yyyy-mm-dd), desired window `[from, to]` in minutes (from the customer). Optional `limit` (default e.g. 5–8).
1. Load service → `durationMin`, `skillId`. 404 if missing.
2. Candidate technicians = those whose technician_skills include `skillId` AND are active.
3. For each candidate tech:
   a. Base availability = the tech's working_hours interval(s) for `weekdayOf(date)`. If none → tech unavailable that day.
   b. Blocks = time_off for that tech/date (whole-day → block the entire working interval; partial → its [startMin,endMin)) + all non-cancelled bookings for that tech/date.
   c. Free intervals = `subtractIntervals` of base minus blocks.
4. Candidate start times: on a **15-minute grid**, only within the desired window `[from, to]`, AND such that `[start, start+durationMin)` is fully `contains`-ed by one free interval (duration fit). (Grid anchored at :00/:15/:30/:45.)
5. **Score each valid (tech, start) slot in [0,1]:**
   - **Rule 1 — proximity (weight 0.40):** closeness of `start` to the desired window. Define a clear metric (e.g. distance from the window's preferred point — the window start, or 0 if inside window; normalize by window span or a fixed horizon). Closer = higher.
   - **Rule 2 — technician load balance (weight 0.30):** techs with FEWER bookings that day score higher. Normalize across the candidate set (e.g. 1 - bookings/maxBookings, or 1/(1+bookings)).
   - **Rule 3 — minimize leftover odd gaps (weight 0.30):** placing this booking should leave as little unusable fragment as possible. E.g. after inserting [start,end) into its free interval, measure the leftover sub-gaps that are smaller than the shortest bookable service (or < durationMin); more small leftover = lower score. Reward starts that align to the edge of a free interval.
   - `score = 0.4*r1 + 0.3*r2 + 0.3*r3`. Document each rule's exact formula in code comments AND the report.
6. Sort by score desc (tiebreak: earlier start, then fewer-loaded tech). Return top `limit`.

## Endpoint — `src/server/routes/slots.ts` (Hono sub-app, routes relative to '/', mounted at /api/slots)
- `GET /suggest?serviceId=&date=&from=&to=&limit=` — validate with Zod (from<to, valid date, positive ids). Returns:
  ```json
  { "service": {"id","name","durationMin"},
    "slots": [ { "technicianId", "technicianName", "startMin", "endMin", "score",
                 "breakdown": {"proximity","load","gap"} } ] }
  ```
  Include the score breakdown so the UI / reviewer can see WHY a slot ranked where it did.

## Structure for testability
Put the PURE ranking logic in a separate function (e.g. `src/server/lib/suggest.ts` — `suggestSlots(input): ScoredSlot[]` taking already-loaded data: service, and per-tech {freeIntervals, bookingCount}) so it's unit-testable WITHOUT a DB. The route handler does the DB loading then calls it.

## Tests — REQUIRED (`src/server/lib/suggest.test.ts`)
Cover: skill filtering excludes unqualified techs; duration fit rejects too-short gaps; 15-min grid; Rule 1 (a slot nearer the desired time outranks a far one, all else equal); Rule 2 (less-loaded tech wins, all else equal); Rule 3 (a start that leaves no odd fragment outranks one that leaves a small unusable gap); overall ordering. Run `npm test` — all green.

## Constraints
- Only create `src/server/routes/slots.ts`, `src/server/lib/suggest.ts`, `src/server/lib/suggest.test.ts`. DO NOT edit app.ts, other routes, schema, seed, or src/client.
- Reuse lib/slots.ts helpers.

## Verify before done
- `npx tsc --noEmit -p tsconfig.server.json` clean; `npm test` green (existing 21 + your new ones).
- Report: files created, the EXACT formula for each of the 3 rules, the `/api/slots/suggest` response shape, and 1–2 concrete worked examples showing the ranking is sane. Do not commit.

## Checklist
- [ ] lib/suggest.ts — pure suggestSlots() (skill/free-intervals/15-min grid/duration fit/scoring)
- [ ] Rule 1 proximity (0.40) — formula documented
- [ ] Rule 2 load-balance (0.30) — formula documented
- [ ] Rule 3 gap-minimization (0.30) — formula documented
- [ ] sort desc + tiebreak; top-N limit
- [ ] routes/slots.ts GET /suggest with Zod + breakdown in response
- [ ] reuses lib/slots.ts (no reimplementation)
- [ ] suggest.test.ts covers all 3 rules + filters + ordering; npm test green
- [ ] tsc clean
- [ ] reported files/formulas/shape/worked-examples
