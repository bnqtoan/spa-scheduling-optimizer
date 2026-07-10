# Task 14 — Error taxonomy + structured logging (Phase 2, cross-cutting) (#6)

**Model/effort:** Opus / high
**Depends on:** 13 (schema). Blocks: 15–19 (they throw AppError).

## Goal
Give the app a layered error taxonomy so any failure is attributable to a tier (UI/API/AUTH/DB/BUSINESS/EXTERNAL), returned to the client as a stable code, and emitted as a structured JSON log line on the Worker. Retrofit the EXISTING bookings route's ad-hoc 409/422 responses onto this taxonomy.

## Key facts
- Hono app: `src/server/app.ts` (Env = { Bindings: { DB, ASSETS } }). Routers mounted at `/api/*`. **DO NOT edit app.ts's route mounts** — but you MAY add a single `app.onError(...)` handler and (if needed) export a helper the Planner wires. Confirm with Planner: preferred is you EXPORT `onError` + `AppError` from a lib, Planner adds the one line `app.onError(appOnError)` to app.ts. If Planner delegates, you add that one line only.
- Existing bookings route `src/server/routes/bookings.ts` returns raw `c.json({error}, 409|422)` for skill/working-hours/time_off/overlap. These must be re-expressed via AppError (behavior/status codes unchanged, only the shape + code standardized).

## Deliverable — `src/server/lib/errors.ts`
- `type ErrorCategory = 'VALIDATION' | 'AUTH' | 'BUSINESS' | 'DB' | 'EXTERNAL'`
- `class AppError extends Error` with: `category`, `code` (string like `BUSINESS_SLOT_OVERLAP`), `httpStatus` (number), optional `context` (record), optional `cause`.
- Named factory helpers / constants for the codes actually used now:
  - `VALIDATION_INVALID_INPUT` (400), `VALIDATION_SKILL_MISMATCH` (422), `VALIDATION_OUTSIDE_HOURS` (422), `VALIDATION_TIME_OFF` (422)
  - `BUSINESS_SLOT_OVERLAP` (409), `BUSINESS_INVALID_STATUS` (409)
  - `AUTH_UNAUTHORIZED` (401), `AUTH_FORBIDDEN` (403)
  - `DB_QUERY` (500), `DB_CONSTRAINT` (409)
  - `EXTERNAL_SEPAY` (502), `EXTERNAL_EMAIL` (502)
- `appOnError(err, c)` — the Hono error handler:
  - If `err instanceof AppError`: log structured JSON at level from status (>=500 ERROR else WARN), respond `c.json({ error: { code, category, message } }, httpStatus)`.
  - Else (unexpected): treat as `DB_QUERY`/500 category `DB` OR a generic `INTERNAL` — log full stack as ERROR, respond generic `{ error: { code: 'INTERNAL', category: 'DB', message: 'internal error' } }` (never leak internals to client).
  - Structured log shape (console.log JSON.stringify): `{ timestamp, level, category, code, message, requestId, context }`. Get `requestId` from a header (`cf-ray` or a generated id via crypto.randomUUID) — put it on `c.set('requestId', ...)` in a tiny middleware if not present.
- A helper `logStructured(level, fields)` reused by app code (e.g. Task 17 webhook logs success too).

## Retrofit
- In `src/server/routes/bookings.ts`, replace the raw error responses with `throw new AppError(...)` using the codes above (skill→VALIDATION_SKILL_MISMATCH 422, working-hours→VALIDATION_OUTSIDE_HOURS 422, time_off→VALIDATION_TIME_OFF 422, overlap→BUSINESS_SLOT_OVERLAP 409). Same status codes as today. This is the ONLY existing route you edit.

## Tests — REQUIRED (`src/server/lib/errors.test.ts`)
- AppError carries category/code/status; appOnError maps a known AppError to the right JSON+status; unknown error → generic INTERNAL 500 with no leak; log line is valid JSON with required fields.

## Constraints
- Create `src/server/lib/errors.ts`, `src/server/lib/errors.test.ts`. Edit ONLY `src/server/routes/bookings.ts` (retrofit) and — if Planner delegates — one `app.onError` line in `app.ts`.
- Do NOT change status codes of existing behaviors. Do NOT touch schema/seed/client.

## Verify before done
- `npx tsc --noEmit -p tsconfig.server.json` clean; `npm test` green.
- Live smoke: POST an overlapping booking → response `{error:{code:'BUSINESS_SLOT_OVERLAP',category:'BUSINESS'}}` at 409; a Worker log line JSON printed.
- Report: the full code table, the log shape, and the bookings.ts diff summary.

## Checklist
- [ ] lib/errors.ts — AppError class + ErrorCategory + code constants + appOnError + logStructured + requestId
- [ ] bookings.ts retrofitted to AppError (same statuses)
- [ ] app.onError wired (self or Planner one-liner — note which in report)
- [ ] errors.test.ts green; tsc clean; live 409 smoke shows standardized shape + JSON log
