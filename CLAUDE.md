# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Spa Scheduling Optimizer

Web app for a spa to manage technician (KTV) schedules and optimize customer booking. PRD: `Spa Scheduling Optimizer.pdf`. Core feature = **Suggest Available Slots** (scored slot suggestions). UI language: Vietnamese. Mockup reference is the PDF.

**Architecture reference: `docs/ARCHITECTURE.md`** — problem/business outcome, domain model (ER), tech architecture + data-flow diagrams (mermaid). Read it for the big picture; keep it in sync when domain model, scoring, or data flow changes.

### Stack
- **Frontend** (`src/client`): React + Vite + TanStack Router (code-based, `src/client/router.tsx`) + TanStack Query + Tailwind v4 + shadcn/ui + FullCalendar (resource-timeline). Same-origin API via `/api` (Vite dev proxy).
- **Backend** (`src/server`): single Cloudflare Worker — Hono handles `/api/*`, all other paths serve the built SPA via the ASSETS binding (`src/server/index.ts`). Drizzle ORM + Cloudflare D1 + Zod.
- Deploy: one Worker (API + SPA). D1 binding `DB` (database `spa-db`).

### Commands
- `npm run dev` — client (vite) + worker (`wrangler dev`) together (npm-run-all).
- `npm run build` — `vite build` → `dist/client`.
- `npm run deploy` — build + `wrangler deploy`.
- `npm test` — vitest (unit tests for `src/server/lib/*`). Run one file: `npx vitest run src/server/lib/suggest.test.ts`.
- `npm run db:generate` — drizzle-kit migration from `src/server/db/schema.ts`.
- `npm run db:migrate` — apply migrations to **local** D1. For remote: `npx wrangler d1 migrations apply spa-db --remote`.
- `npm run db:seed` — `wrangler d1 execute spa-db --local --file=src/server/db/seed.sql` (idempotent; seed mirrors the mockup: 5 KTV, 4 skills, 6 services, working_hours 09:00–19:00, 7 sample bookings for today).
- Typecheck: `npx tsc --noEmit -p tsconfig.app.json` (client) / `-p tsconfig.server.json` (server).

### Architecture notes (the non-obvious parts)
- **Times are integers = minutes-from-midnight**; dates are ISO `yyyy-mm-dd` strings. Weekday convention **0=Sunday..6=Saturday**. Intervals are **half-open [start, end)** (back-to-back bookings don't conflict).
- **11 tables** (`src/server/db/schema.ts`): technicians (+email P2), skills, technician_skills (M2M), services (skillId required, durationMin, price VND), working_hours (weekday/startMin/endMin), time_off (date + optional startMin/endMin; null/null = whole day), bookings (code unique `SPA{yymmdd}-{seq}`, status scheduled|completed|cancelled; +paymentStatus/paymentRef/createdByUserId P2). **P2:** users (role admin|receptionist|technician, technicianId→technicians), sessions (opaque cookie token), payments (paymentRef unique A-Z0-9, status pending|paid|failed, sepayTxId, rawPayload), audit_log (action create|update|cancel|pay, old/new JSON).
- **`src/server/lib/slots.ts`** — pure interval helpers (`overlaps`, `contains`, `weekdayOf`, `subtractIntervals`). Reused by both bookings and slot-suggestion. Keep pure + unit-tested.
- **`src/server/lib/suggest.ts`** — the CORE. `suggestSlots()` is pure/DB-free: skill-filtered techs → free intervals (`subtractIntervals(workingHours, timeOff+bookings)`) → 15-min grid within desired window → duration fit → **score = 0.4·proximity + 0.3·loadBalance + 0.3·gapMinimization**, sort desc. Route `src/server/routes/slots.ts` does DB loading then calls it.
- **No-double-booking invariant**: `POST /api/bookings` derives `endMin` server-side and re-validates (skill→422, working-hours→422, time_off→422, overlap→**409**) immediately before insert. Never trust a client-sent endMin. Cancelling = soft (status='cancelled'); services delete = soft (active=false).
- API routers each `export default` a Hono sub-app (technicians also exports `skillsRoute`); all mounted in `src/server/app.ts` at `/api/{auth,technicians,skills,services,schedule,bookings,slots,webhooks}`. **P2 middleware (app-wide):** `attachRequestId` + `authMiddleware` (sets `c.var.user`, never rejects); guards `requireAuth`/`requireRole` in `src/server/middleware/auth.ts`.
- **P2 auth/payment/audit/errors:** `lib/auth.ts` (PBKDF2 Web Crypto), `lib/session.ts` (D1 sessions, cookie `spa_session`), `lib/rbac.ts` (technician scoped to own technicianId), `lib/audit.ts` (`writeAudit`, best-effort append-only), `lib/payment.ts` (paymentRef `SPA0012AB`, VietQR, `matchWebhookToPayment` — SePay is webhook-reconciliation NOT redirect, idempotent by sepayTxId), `lib/email.ts` (Resend, never throws, fire-and-forget via waitUntil), `lib/errors.ts` (`AppError(category,code,httpStatus)` + `appOnError` → `{error:{code,category,message}}` + structured log; categories VALIDATION/AUTH/BUSINESS/DB/EXTERNAL).
- Client data layer: `src/client/lib/api.ts` (shared `apiFetch` + hooks/types), plus feature-scoped `booking-api.ts` / `stats-api.ts` that reuse `apiFetch`. Time formatting in `src/client/lib/time.ts`.
- **SPA fallback**: `wrangler.toml` `[assets] not_found_handling = "single-page-application"` — required so deep routes (`/book`, `/technicians`, …) and refresh serve `index.html`.
- `schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source'` for FullCalendar resource-timeline (free OSS license).

### Scope
**Phase 2 IN (was non-goal, user-approved):** auth/login + role (admin/receptionist/technician), payment via **SePay** VietQR webhook, email via **Resend**. Seed users `admin`/`letan`/`ktv1..5`, password `spa123` — **change before production**. Secrets via `wrangler secret put`: `SEPAY_WEBHOOK_TOKEN`, `SEPAY_BANK`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`, `RESEND_API_KEY`, `EMAIL_FROM` (email/payment no-op safely if unset).
**Still non-goals — do NOT add:** Google Calendar sync, multi-branch, multi-tenant, online meeting, membership/loyalty, SMS.

## Planner workflow (how this project was/should be built)

This project is coordinated by a **Planner** session that does NOT implement directly. It:
1. Splits a feature into small tasks, each written to `tasks/NN-*.md` **ending with a checklist**.
2. Dispatches a **Sub-Agent per task** with model+effort matched to the work.
3. Enforces **disjoint file ownership** across parallel agents (e.g. API agents never edit `app.ts` — the Planner mounts routers; one agent owns `api.ts`, others add feature-scoped `*-api.ts`).
4. **Verifies every task itself** (tsc/build/test + live smoke test) before marking it done — an agent's "done" report is not trusted until the Planner confirms on disk.

### Model / effort policy
| Work | Model / effort |
|---|---|
| Config, mechanical edits | Haiku / low |
| Standard CRUD, UI screens | Sonnet / medium |
| Core logic & correctness-critical (slot engine, bookings/double-book, FullCalendar timeline, booking wizard, deploy) | Opus / high |

### Task specs live in `tasks/`
`00-scaffold` → `01-db-schema-seed` → API (`02` tech/skills, `03` services, `04` schedule, `05` bookings, `06` slot-suggestion) → UI (`07` shell, `08` dashboard, `09` admin CRUD, `10` booking flow, `11` stats/settings) → `12` e2e+deploy. Dependency graph and full detail in each file and in the plan.
