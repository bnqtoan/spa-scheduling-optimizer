# Task 13 — Schema: users, sessions, payments, audit_log + booking cols + seed (Phase 2)

**Model/effort:** Opus / high
**Depends on:** Phase 1 done (01 schema/seed). Blocks: 14–20 (everything).

## Goal
Extend the DB schema for Phase 2 (auth, payment, audit) WITHOUT touching existing tables' semantics. Add 4 new tables + 3 columns to `bookings`, generate one migration, and seed initial users. Core invariants (times = minutes-from-midnight, dates ISO `yyyy-mm-dd`, half-open intervals) unchanged.

## Key facts
- Schema: `src/server/db/schema.ts` (Drizzle + sqlite-core). Existing 7 tables — DO NOT change their columns. Follow existing style: `sqliteTable`, `integer('...', { mode: 'boolean' })`, `text` PKs where noted, `relations()` blocks, inferred `$inferSelect`/`$inferInsert` type exports at the bottom.
- Migration: `npm run db:generate` (drizzle-kit) → then `npm run db:migrate` (local). Output dir is **`./migrations`** (see drizzle.config.ts). Do NOT hand-write SQL migrations.
- Seed: `src/server/db/seed.sql`. Existing seed style = **DELETE (child→parent) then INSERT with explicit ids**, and resets `sqlite_sequence`. Match this style for the new tables (add their DELETEs at the top in child→parent order: sessions→users, payments→audit_log→ before bookings' existing block; add them to the sqlite_sequence reset). Use explicit ids for users (1..7). Idempotent = safe to re-run.

## New tables (add to schema.ts)
1. **users**
   - `id` integer PK autoincrement
   - `username` text notNull, unique index
   - `passwordHash` text notNull
   - `role` text notNull, enum `['admin','receptionist','technician']`
   - `technicianId` integer nullable, references `technicians.id` (only set for role=technician)
   - `active` boolean notNull default true
   - `createdAt` text default current_timestamp
2. **sessions**
   - `id` text PK (opaque random token, set by app, NOT autoincrement)
   - `userId` integer notNull, references `users.id` onDelete cascade
   - `expiresAt` integer notNull (unix epoch seconds)
   - `createdAt` text default current_timestamp
3. **payments**
   - `id` integer PK autoincrement
   - `bookingId` integer notNull, references `bookings.id`
   - `paymentRef` text notNull, unique index (A-Z0-9 only, e.g. `SPA0012AB` — the VietQR transfer content)
   - `amount` integer notNull (VND)
   - `method` text notNull, enum `['sepay','cash']` (default 'sepay')
   - `status` text notNull, enum `['pending','paid','failed']` default 'pending'
   - `sepayTxId` text nullable (SePay transaction id from webhook)
   - `rawPayload` text nullable (JSON string of the SePay webhook body, for reconciliation)
   - `paidAt` text nullable
   - `createdAt` text default current_timestamp
4. **audit_log**
   - `id` integer PK autoincrement
   - `bookingId` integer nullable, references `bookings.id`
   - `userId` integer nullable, references `users.id` (null = customer self-service)
   - `action` text notNull, enum `['create','update','cancel','pay']`
   - `oldValues` text nullable (JSON string)
   - `newValues` text nullable (JSON string)
   - `createdAt` text default current_timestamp

## Columns to ADD to `bookings`
- `paymentStatus` text notNull, enum `['unpaid','paid']` default `'unpaid'` (denormalized for fast list queries)
- `paymentRef` text nullable (denormalized; also stored in payments — for QR display + quick lookup)
- `createdByUserId` integer nullable, references `users.id` (null = customer)

Add `relations()` for the new tables (users↔sessions, users↔technician, payments↔bookings, audit_log↔bookings/users) and export inferred types (`User`/`NewUser`, `Session`, `Payment`, `AuditLog`, etc.). Export the enum value arrays (e.g. `userRoleValues`, `paymentStatusValues`, `auditActionValues`) like existing `bookingStatusValues`.

## Seed (append to seed.sql, idempotent — use INSERT OR IGNORE / consistent ids)
- 1 admin: username `admin`, role `admin`, technicianId null
- 1 receptionist: username `letan`, role `receptionist`, technicianId null
- 5 technician users mapped to technicians 1–5: usernames `ktv1`..`ktv5`, role `technician`, technicianId 1..5
- **passwordHash** = the hash of default password `spa123` using the SAME hashing scheme Task 15 will use (PBKDF2 via Web Crypto). COORDINATE: Task 15 owns the hash function; here, put a clearly-marked placeholder hash string and a `-- TODO(task15): replace with real PBKDF2 hash of spa123` comment. The Planner will fill the real hash after Task 15 lands the hasher, OR Task 15 updates the seed. Do NOT invent a hash format that won't verify.

## Constraints
- ONLY edit `src/server/db/schema.ts` and `src/server/db/seed.sql`, and generate migration files via `npm run db:generate` (commit the generated migration file under `drizzle/` or the configured migrations dir — check drizzle config).
- DO NOT change existing table columns, routes, or client.
- DO NOT edit app.ts.

## Verify before done
- `npm run db:generate` produces a clean migration; `npm run db:migrate` applies locally with no error.
- `npx tsc --noEmit -p tsconfig.server.json` clean.
- `npm run db:seed` runs idempotently (twice = no error, no dup users).
- Report: new tables/columns, the enum arrays exported, seed users created, and the exact placeholder-hash coordination note for Task 15. Do not commit unless asked.

## Checklist
- [ ] 4 new tables in schema.ts (users, sessions, payments, audit_log) with relations + inferred types + enum arrays
- [ ] 3 new columns on bookings (paymentStatus, paymentRef, createdByUserId)
- [ ] Migration generated via db:generate and applies via db:migrate locally
- [ ] seed.sql: 7 users (admin, letan, ktv1–5) idempotent, with task15 hash-coordination TODO
- [ ] tsc server clean; db:seed idempotent
