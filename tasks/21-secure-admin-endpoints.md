# Task 21 — Secure ung)uarded admin endpoints (Phase 3, SECURITY) (Nhóm B)

**Model/effort:** Opus / high
**Depends on:** Phase 2 (auth middleware, requireRole). Blocks: none (independent of UI tasks).

## Goal
Close a real security hole: the admin CRUD + schedule-mutation endpoints have NO auth guard — anyone (even unauthenticated) can create/update/delete technicians, skills, services, working-hours, time-off by calling the API directly. UI hiding is client-side only. Add proper server-side role enforcement WITHOUT breaking legitimate flows.

## Key facts
- Auth from Phase 2: `authMiddleware` (app-wide, sets `c.var.user`), `requireAuth`, `requireRole(...roles)` in `src/server/middleware/auth.ts` (throws AUTH_UNAUTHORIZED 401 / AUTH_FORBIDDEN 403). Note the Hono Context Bindings-invariance issue solved earlier via a local `currentUser(c)` adapter in bookings.ts — reuse that pattern if `requireRole` middleware doesn't compose cleanly in a given router; check how bookings.ts does staff-only PATCH/DELETE and mirror it.
- Public-by-design (DO NOT lock): `GET` reads that the public `/book` wizard needs — `GET /technicians`, `GET /services`, `GET /skills`, `GET /slots/suggest`, `POST /bookings` (customer self-service), `GET /bookings/:id/payment`, `POST /webhooks/sepay`, auth routes, health.

## Endpoints to guard (add role checks)
Files: `src/server/routes/technicians.ts` (incl. skillsRoute), `src/server/routes/services.ts`, `src/server/routes/schedule.ts`.

**Admin-only (`requireRole('admin')`)** — mutations of catalog/staff config:
- POST/PATCH/DELETE `/api/technicians` + `/api/technicians/:id`
- POST/DELETE `/api/skills` (+ `/:id`)
- POST/PATCH/DELETE `/api/services` (+ `/:id`)
- PUT `/api/schedule/working-hours/:technicianId`
- POST `/api/schedule/time-off`, DELETE `/api/schedule/time-off/:id`

Keep the existing RBAC read-scoping on `GET /schedule/working-hours` and `GET /schedule/time-off` (technician→own) as-is.

Decide with care: should receptionist manage time-off? Per PRD, Admin manages everything; receptionist handles bookings. Default: catalog/staff/schedule config = **admin-only**; if you think receptionist needs time-off, note it but default to admin-only for safety.

## Constraints
- Edit only the 3 route files. Reuse `requireRole`/`currentUser` — do NOT invent new auth. Do NOT touch app.ts mounts, schema, client.
- Do NOT lock the public GET reads or `/book` flow (verify the wizard still works unauthenticated).
- Preserve all existing behavior for authenticated admins.

## Verify before done
- `npx tsc --noEmit -p tsconfig.server.json` clean; `npm test` green (add/adjust any route tests if present).
- Live smoke (build + seed, wrangler dev on 8792):
  - UNAUTHENTICATED `POST /api/technicians` / `DELETE /api/services/:id` / `POST /api/schedule/time-off` → **401** (was 200/201).
  - As `ktv1` (technician) → same → **403**.
  - As `admin` → still works (201/200).
  - Public still OK: `GET /api/technicians`, `GET /api/services`, `GET /api/slots/suggest`, and a full unauthenticated `POST /api/bookings` (customer flow) → still succeed.
- Report: exact endpoints guarded + role, confirmation public/`/book` flow intact, before/after status codes.

## Checklist
- [ ] technicians.ts + skillsRoute mutations → admin-only
- [ ] services.ts mutations → admin-only
- [ ] schedule.ts working-hours PUT + time-off POST/DELETE → admin-only (reads keep RBAC scoping)
- [ ] public GET reads + /book customer POST /bookings still unauthenticated-OK
- [ ] tsc + tests green; live smoke (401 unauth, 403 technician, 200 admin) passes
