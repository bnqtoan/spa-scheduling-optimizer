# Task 16 — RBAC enforcement + audit trail (Phase 2) (#2 #3 #5)

**Model/effort:** Opus / high
**Depends on:** 13 (audit_log, booking cols), 14 (AppError), 15 (auth middleware). Blocks: 19 (UI), 20 (verify).

## Goal
Three things: (a) role-based access on booking/schedule reads/writes; (b) KTV (role=technician) sees ONLY their own bookings (#3); (c) every booking mutation (create/update/cancel/pay) writes an `audit_log` row recording WHO did it and old→new values (#2 #5). Also stamp `bookings.createdByUserId`.

## Key facts
- Auth from Task 15: `c.get('user')` → `{ id, role, technicianId }` or null; `requireAuth`, `requireRole(...)` middleware; AppError codes `AUTH_FORBIDDEN`/`AUTH_UNAUTHORIZED` from Task 14.
- Bookings route: `src/server/routes/bookings.ts` (you edit this — Task 14 already retrofitted its errors; coordinate so you don't clobber that; you own audit + RBAC additions here). Schedule route: `src/server/routes/schedule.ts`.
- `audit_log` table (Task 13): bookingId, userId (null=customer), action create|update|cancel|pay, oldValues JSON, newValues JSON.

## Deliverables
1. **`src/server/lib/audit.ts`** — `writeAudit(db, { bookingId, userId, action, oldValues?, newValues? })` inserts one row; serializes values with JSON.stringify; never throws to caller-fatal (wrap DB error → log via Task 14 logStructured, but do not break the main mutation's success path AFTER commit — decide ordering: audit in same logical flow, best-effort). Document the chosen ordering.
2. **RBAC on routes:**
   - Booking CREATE: allowed for `receptionist`/`admin` (authed) AND public/customer (no user → `createdByUserId=null`, allowed per PRD self-service). Set `createdByUserId = user?.id ?? null`.
   - Booking CANCEL/UPDATE: require authed `receptionist`/`admin` (customers can't cancel others' bookings in this pass — confirm with Planner; default: require staff role).
   - Booking LIST / schedule read: if `user.role === 'technician'`, FORCE-filter `technicianId = user.technicianId` (ignore any client-sent technician filter that differs → or 403 if they ask for another tech). `admin`/`receptionist` see all. Unauthed schedule read: decide with Planner — default require auth for the admin schedule view, keep the public slot-suggestion (`/api/slots`) open.
3. **Audit writes:** on successful create → `writeAudit(action:'create', newValues: booking)`; on cancel → `action:'cancel', oldValues:{status:'scheduled'}, newValues:{status:'cancelled'}`; on update (if update endpoint exists) → old vs new. (Task 17 will call writeAudit for `pay`.) Export `writeAudit` for Task 17 reuse.
4. **`GET /api/audit?bookingId=` (or under bookings, e.g. `GET /api/bookings/:id/audit`)** — admin-only (`requireRole('admin')`) list of audit rows for a booking, newest first, joined with username. This backs the admin "who did what" view (#2). Coordinate mount point with Planner.

## Constraints
- Create `src/server/lib/audit.ts`; edit `src/server/routes/bookings.ts` and `src/server/routes/schedule.ts` for RBAC + audit + createdByUserId. Add the audit-list endpoint (in bookings router or a small `routes/audit.ts` — coordinate mount).
- DO NOT edit app.ts mounts (Planner). DO NOT weaken Task 14's error retrofit. DO NOT touch the slot engine or client.
- Preserve the no-double-booking invariant exactly — RBAC/audit are additive, never bypass the overlap re-validation before insert.

## Tests — REQUIRED (`src/server/lib/audit.test.ts` at minimum)
- writeAudit serializes old/new correctly; a technician-scoped filter excludes other techs' bookings (unit-test the filter helper if you extract one). Route-level RBAC can be smoke-tested live.

## Verify before done
- tsc server clean; `npm test` green.
- Live smoke: login as `ktv1` → schedule/list returns only technician 1's bookings; asking for tech 2 → filtered/403. Login as `letan` → create a booking → an audit_log row with userId=letan, action=create exists; cancel → audit action=cancel with old/new. `GET audit` as admin returns the timeline; as ktv1 → 403.
- Report: RBAC matrix (role × action), audit ordering decision, audit endpoint path.

## Checklist
- [ ] lib/audit.ts writeAudit (+ exported for Task 17)
- [ ] RBAC: technician sees only own bookings; staff-only cancel/update; createdByUserId stamped
- [ ] audit rows on create + cancel (+ update if endpoint exists)
- [ ] admin-only audit-list endpoint
- [ ] tests green; tsc clean; live RBAC + audit smoke passes; overlap invariant intact
