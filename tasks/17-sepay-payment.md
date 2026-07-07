# Task 17 — SePay payment: paymentRef, VietQR, webhook reconciliation (Phase 2) (#1)

**Model/effort:** Opus / high
**Depends on:** 13 (payments table, booking cols), 14 (AppError/log), 16 (writeAudit). Blocks: 19 (payment UI), 20 (verify).

## Goal
Let a customer pay a booking via SePay (VietQR bank transfer reconciled by webhook — NOT a redirect gateway). On booking, generate a payment reference + a VietQR the customer scans; when SePay POSTs the matching transfer to our webhook, mark the payment/booking paid, audit it, and (Task 18) trigger email.

## SePay mechanics (confirmed)
- SePay watches a bank account's balance changes and POSTs each incoming transfer to our webhook. There is NO redirect/callback URL flow. Matching is by the **transfer content** = our `paymentRef`.
- Webhook payload (fields vary; handle defensively): transaction id, transferAmount (VND), transferType (`in`/`out`), content/description (contains the paymentRef), gateway/bank, transactionDate, referenceCode. Respond `200 { success: true }` within 30s.
- Auth: SePay sends an `Authorization: Apikey <token>` header (configurable). Verify against `env.SEPAY_WEBHOOK_TOKEN`.

## paymentRef design
- Format: `SPA` + zero-padded booking id + 2 random uppercase alnum, e.g. `SPA0012AB`. **A-Z0-9 only** (banks/OCR drop `-`; do NOT reuse booking.code which has `-`). Uniqueness enforced by the `payments.paymentRef` unique index (Task 13). Store the ref on both `payments` and denormalized `bookings.paymentRef`.

## Deliverables
1. **`src/server/lib/payment.ts`**
   - `generatePaymentRef(bookingId): string` (deterministic prefix + crypto random suffix).
   - `buildVietQrUrl({ bank, accountNumber, accountName, amount, content })` → the SePay/VietQR image URL (`https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=<paymentRef>`) — confirm exact params from SePay docs. Pure string builder.
   - `matchWebhookToPayment(payload, payments[])` — pure: given a webhook body and pending payments, find the one whose paymentRef appears in the content AND amount matches (transferType='in'). Return the matched payment or null. UNIT-TESTABLE (no DB).
2. **Payment creation hook** — when a booking is created (coordinate with Task 16's create path; you own the payment side): create a `payments` row (status pending, amount = service.price, paymentRef), set `bookings.paymentRef`. Expose `GET /api/bookings/:id/payment` returning `{ paymentRef, amount, status, qrUrl }` for the UI.
3. **`src/server/routes/webhooks.ts`** (Hono sub-app, mounted at `/api/webhooks` by Planner — PUBLIC, no auth cookie; this is server-to-server):
   - `POST /sepay` — verify `Authorization` apikey (else `AUTH_UNAUTHORIZED`); parse body; if `transferType==='in'`, `matchWebhookToPayment` against pending payments; on match: set payment `status='paid'`, `sepayTxId`, `rawPayload`, `paidAt`; set `bookings.paymentStatus='paid'`; `writeAudit(action:'pay', userId:null, newValues:{amount, sepayTxId})`; log structured success; (Task 18 hook: fire email). On no-match: log + still return 200 `{success:true}` (SePay retries otherwise; store rawPayload in a stray-log or ignore — document). Always respond 200 `{success:true}` on handled, non-200 only on auth failure.
   - Idempotency: if a webhook with the same `sepayTxId` already marked paid, no-op (don't double-audit).

## Config / secrets (document for Planner to set)
- `SEPAY_WEBHOOK_TOKEN`, `SEPAY_BANK`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME` — via `wrangler secret` / vars. Add to Env `Bindings` type. Provide a `.dev.vars.example`.

## Tests — REQUIRED (`src/server/lib/payment.test.ts`)
- generatePaymentRef format (A-Z0-9, contains booking id); matchWebhookToPayment: matches by ref+amount, rejects wrong amount, rejects transferType out, picks the right one among several, returns null when no ref in content.

## Constraints
- Create `src/server/lib/payment.ts`, `src/server/routes/webhooks.ts`, `src/server/lib/payment.test.ts`, `.dev.vars.example`. Add payment endpoint (in bookings router or here — coordinate). Extend Env Bindings type for secrets.
- DO NOT edit app.ts mounts (Planner mounts `/api/webhooks`). DO NOT weaken Task 16 audit or Task 14 errors. Reuse `writeAudit`, `AppError`, `logStructured`.

## Verify before done
- tsc server clean; `npm test` green.
- Live smoke: create booking → `GET /api/bookings/:id/payment` returns pending + qrUrl; simulate `POST /api/webhooks/sepay` (curl with the apikey header + a body whose content contains the paymentRef and matching amount) → payment paid, booking.paymentStatus='paid', audit 'pay' row; replay same tx → idempotent no-op; wrong apikey → 401.
- Report: paymentRef format, qrUrl template, webhook match rules, idempotency approach, required secrets.

## Checklist
- [ ] lib/payment.ts (generatePaymentRef, buildVietQrUrl, matchWebhookToPayment pure)
- [ ] payments row created on booking + GET payment endpoint (qrUrl)
- [ ] routes/webhooks.ts POST /sepay: apikey verify, match, mark paid, audit 'pay', idempotent, always 200 on handled
- [ ] Env secrets + .dev.vars.example
- [ ] payment.test.ts green; tsc clean; live webhook simulation + idempotency + auth smoke passes
