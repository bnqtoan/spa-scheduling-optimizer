# Task 18 — Email notification via Resend (Phase 2) (#4)

**Model/effort:** Sonnet / medium
**Depends on:** 13 (schema), 14 (AppError/log), 16 (booking create hook), 17 (paid hook). Blocks: 20 (verify).

## Goal
When a booking is created, email the assigned technician (the person doing the service) that they have a new booking. Also send a confirmation on payment paid. Use Resend's HTTP API (fits Cloudflare Worker — no SMTP). Failures must NOT break the booking/payment flow.

## Key facts
- Technician has no email column today. ADD `technicians.email` (nullable text) — coordinate with Planner: this is a small schema add; either fold into Task 13's migration (preferred if 13 not yet applied) or add a follow-up migration. Document which. Seed technicians with placeholder emails.
- Resend API: `POST https://api.resend.com/emails` with `Authorization: Bearer <RESEND_API_KEY>`, JSON `{ from, to, subject, html }`. `from` must be a verified domain address.
- Structured logging + AppError from Task 14: wrap Resend failures as `EXTERNAL_EMAIL` but SWALLOW them at the call site (log, don't throw) so a booking still succeeds if email is down.

## Deliverables
1. **`src/server/lib/email.ts`**
   - `sendEmail(env, { to, subject, html }): Promise<{ ok: boolean }>` — calls Resend; on non-2xx or throw, `logStructured('ERROR', { code:'EXTERNAL_EMAIL', ... })` and return `{ok:false}` (never throw).
   - `renderNewBookingEmail(booking, service, technician)` → `{ subject, html }` (Vietnamese copy; include date, time HH:MM from minutes, service name, customer name/phone, booking code).
   - `renderPaymentPaidEmail(booking, service)` → `{ subject, html }`.
2. **Wire triggers (best-effort, after the mutation commits):**
   - After booking create (Task 16's create path): if technician has an email, `sendEmail(renderNewBookingEmail(...))`. Fire-and-forget via `c.executionCtx.waitUntil(...)` so the response isn't blocked. If `waitUntil` unavailable in dev, await but catch.
   - After payment paid (Task 17 webhook): send `renderPaymentPaidEmail` (to technician and/or receptionist — pick technician; document).
   - Coordinate the exact call sites with Planner so you don't fight Tasks 16/17 for the same lines — prefer exposing a `notifyNewBooking(env, ctx, ...)` helper that those tasks call, OR you add the call right after their audit write. Decide and document.
3. Config: `RESEND_API_KEY`, `EMAIL_FROM` in Env Bindings + `.dev.vars.example`. In dev without a key, `sendEmail` should log-and-noop (return ok:false) — never crash.

## Tests — REQUIRED (`src/server/lib/email.test.ts`)
- renderNewBookingEmail includes date/time/service/customer and formats minutes→HH:MM correctly; sendEmail returns ok:false (no throw) when fetch rejects / non-2xx (mock global fetch); missing API key → noop ok:false.

## Constraints
- Create `src/server/lib/email.ts`, `src/server/lib/email.test.ts`, update `.dev.vars.example`. Add the trigger calls in the create/paid paths (coordinate). Add `technicians.email` (schema+seed) per the coordination note.
- DO NOT block or fail the booking/payment on email error. DO NOT edit app.ts mounts. Reuse logStructured.

## Verify before done
- tsc server clean; `npm test` green.
- Live smoke (dev, no real key): create a booking → server logs an email attempt (noop ok:false) and booking still 201; with a real key set → technician receives the email. Minutes→HH:MM correct in the body.
- Report: email provider config, trigger call sites, the fire-and-forget approach, and the technicians.email coordination decision.

## Checklist
- [ ] lib/email.ts (sendEmail via Resend, never throws; renderNewBookingEmail, renderPaymentPaidEmail — Vietnamese)
- [ ] technicians.email added (schema+seed) — note where
- [ ] triggers on booking-create and payment-paid (fire-and-forget, best-effort)
- [ ] Env config + .dev.vars.example; dev noop-without-key
- [ ] email.test.ts green; tsc clean; live create-booking still succeeds with email down
