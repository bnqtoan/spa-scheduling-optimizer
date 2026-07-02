# Task 01 — DB Schema + Seed (Phase 1)

**Model/effort:** Sonnet / medium
**Depends on:** 00 (done). Blocks: 02,03,04,05.

## Goal
Define the Drizzle schema for all 7 PRD tables in `src/server/db/schema.ts`, generate the D1 migration, and write a seed that mirrors the mockup so the app has realistic data on day one.

## Working dir
`/Users/bnqtoan/Documents/CCF/session-1-demo` (scaffold already in place: Hono worker, D1 binding `DB`, drizzle.config.ts pointing at `src/server/db/schema.ts`, `db:generate` + `db:migrate` scripts exist).

## Tables (SQLite / D1 — use drizzle-orm/sqlite-core)
1. **technicians** — id (pk), name, avatar_url (nullable), active (bool, default true), created_at.
2. **skills** — id (pk), name (unique). e.g. Massage, Facial, Nail, Gội đầu.
3. **technician_skills** — technician_id (fk), skill_id (fk); composite PK. Many-to-many.
4. **services** — id (pk), name, skill_id (fk — required skill), duration_min (int), price (int, VND), active (bool default true). 
5. **working_hours** — id (pk), technician_id (fk), weekday (0–6, 0=Sunday), start_min (int, minutes from midnight), end_min (int). One+ rows per tech per weekday.
6. **time_off** — id (pk), technician_id (fk), date (ISO yyyy-mm-dd) OR start_min/end_min for partial-day (support both: nullable start_min/end_min → null means whole day). reason (nullable).
7. **bookings** — id (pk), code (unique, e.g. SPA240525-0012), technician_id (fk), service_id (fk), customer_name, customer_phone, note (nullable), date (yyyy-mm-dd), start_min (int), end_min (int), status (enum text: scheduled|completed|cancelled, default scheduled), created_at.

Store times as **integer minutes-from-midnight** + a separate `date` string — simplest for slot math and D1. Add relations() for joins. Export inferred types.

## Seed (match the mockup exactly)
- Skills: Massage, Facial, Nail, Gội đầu.
- 5 technicians with skills:
  - Lan Anh → Massage, Facial
  - Mai Chi → Nail, Facial
  - Thu Hà → Massage, Gội đầu
  - Minh Thư → Nail, Massage
  - Kim Ngân → Facial, Gội đầu
- 6 services (name, skill, duration_min, price):
  - Massage thư giãn — Massage — 60 — 450000
  - Massage body — Massage — 90 — 650000
  - Facial cơ bản — Facial — 60 — 400000
  - Facial nâng cơ — Facial — 75 — 600000
  - Nail tay — Nail — 60 — 250000
  - Gội đầu dưỡng sinh — Gội đầu — 45 — 200000
- working_hours: all 5 techs, Mon–Sun (or Mon–Sat, your call — document it), 09:00–19:00 → start_min 540, end_min 1140.
- A handful of sample bookings for "today" so the dashboard timeline isn't empty (spread across techs, non-overlapping). Booking codes follow SPA{yymmdd}-{4-digit seq}.

## How to run seed
Create `src/server/db/seed.ts`. Provide an npm script `db:seed` that executes it against **local D1** (via `wrangler d1 execute spa-db --local --file=...` from generated SQL, OR a wrangler-invoked script — whichever is reliable). Document the exact command in the report. Idempotent if feasible (delete-then-insert or INSERT OR IGNORE).

## Do
1. Write `src/server/db/schema.ts` (all tables + relations + types).
2. `npm run db:generate` → migration in `migrations/`.
3. `npm run db:migrate` → apply to local D1. Confirm tables exist.
4. Write seed + `db:seed` script; run it; confirm rows.
5. Also export a Drizzle client factory `src/server/db/client.ts` — `getDb(env.DB)` returning `drizzle(env.DB, { schema })` — for API tasks to reuse.

## Constraints
- SQLite/D1 types only. No Postgres-isms.
- Don't build any API routes (that's tasks 02–05). Just schema + client factory + seed.

## Verify before done
- `npm run db:migrate` applies clean on a fresh local DB.
- Query local D1 to show row counts per table (technicians=5, skills=4, services=6, working_hours≥35, bookings≥5).
- Report: schema summary, the exact `db:seed` command, weekday convention chosen, and row counts.

## Checklist
- [ ] schema.ts — 7 tables + relations + inferred types
- [ ] db/client.ts — getDb(env.DB) factory
- [ ] migration generated
- [ ] migration applies to local D1
- [ ] seed.ts + db:seed script
- [ ] seed runs; row counts correct (5/4/6/≥35/≥5)
- [ ] times stored as minutes-from-midnight + date string
- [ ] reported command + counts + weekday convention
