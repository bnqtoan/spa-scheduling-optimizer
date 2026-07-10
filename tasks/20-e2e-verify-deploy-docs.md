# Task 20 — Phase-2 e2e verify + docs/CLAUDE.md sync + deploy (Phase 2)

**Model/effort:** Opus / high
**Depends on:** 13–19 all done + Planner-verified. Blocks: none (final).

## Goal
End-to-end verify the whole Phase-2 surface on a running app, apply the remote D1 migration, deploy, and update the living docs (`docs/ARCHITECTURE.md`, `CLAUDE.md`) so the codebase's non-goals and architecture reflect reality (auth/payment/email are now IN).

## E2E scenarios (run against `npm run dev`, then smoke prod after deploy)
1. **Auth + RBAC:** login admin/letan/ktv1; ktv1 sees only own schedule; ktv1 blocked from admin/audit (403 + UI guard); logout redirects.
2. **Booking + audit:** letan creates a booking → audit `create` with userId=letan + `createdByUserId` set; cancel → audit `cancel`; admin audit view shows the timeline.
3. **No-double-book still holds:** overlapping booking → 409 `BUSINESS_SLOT_OVERLAP` (Task 14 shape). Slot suggestion (`/api/slots/suggest`) unchanged.
4. **Payment:** create booking → QR + paymentRef; POST simulated SePay webhook (correct apikey, content contains ref, amount matches) → payment paid, booking.paymentStatus=paid, audit `pay`, UI flips to success; replay → idempotent; wrong apikey → 401.
5. **Email:** with no key → booking still succeeds, log shows email noop; (if a real key/domain is configured) technician receives new-booking email.
6. **Error taxonomy:** a validation failure, an auth failure, and a business conflict each return the standardized `{error:{code,category}}` and emit a structured JSON log line — confirm you can attribute each to its tier.

## Deploy
- Apply remote migration: `npx wrangler d1 migrations apply spa-db --remote`.
- Set secrets (document exact commands; do NOT print secret values): `SEPAY_WEBHOOK_TOKEN`, `SEPAY_BANK`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`, `RESEND_API_KEY`, `EMAIL_FROM` via `wrangler secret put ...`.
- `npm run deploy`. Smoke the deployed URL: login, create booking, webhook (if the SePay endpoint is registered), audit.
- Configure SePay to point its webhook at `https://<worker>/api/webhooks/sepay` with the token (document steps; may require user action — flag to Planner/user).

## Docs to update
1. **`docs/ARCHITECTURE.md`** — add Phase-2: update the ER mermaid (users, sessions, payments, audit_log + new booking cols), add a data-flow diagram for auth+RBAC and for the SePay payment/webhook loop, add the error-taxonomy section and the email-notify flow. Update the route table + business-outcome table.
2. **`CLAUDE.md`** — update the **Scope (non-goals)** section: auth/login, payment (SePay), email (Resend) are now IN scope; keep the rest as non-goals. Add the new tables to the architecture-notes table count (7→11) and note the new routes (`/api/auth`, `/api/webhooks`, audit). Note default seed users + `spa123` and that it must be changed.

## Constraints
- This task may edit docs and run deploy/migration commands. Do NOT change feature code except to fix a bug found during e2e (report any such fix). Never print secret values.

## Verify before done
- All 6 e2e scenarios pass locally; `npm test` fully green; `npx tsc --noEmit` clean for both tsconfigs; `npm run build` ok.
- Remote migration applied; deploy live; prod smoke (auth + booking + audit at minimum) passes.
- Docs updated and internally consistent with the shipped schema/routes.
- Report: e2e results per scenario, deploy URL, migration/secret commands run (values redacted), doc diffs summary, and any SePay/Resend config still requiring user action.

## Checklist
- [ ] 6 e2e scenarios pass locally (auth/RBAC, booking+audit, no-double-book, payment+webhook+idempotency, email best-effort, error taxonomy tiers)
- [ ] full test suite + tsc (both) + build green
- [ ] remote D1 migration applied; secrets set (redacted); deployed; prod smoke passes
- [ ] docs/ARCHITECTURE.md updated (ER + auth/payment/error/email flows + tables/routes)
- [ ] CLAUDE.md non-goals + architecture notes updated (seed users/spa123 flagged)
- [ ] report with SePay/Resend config actions still needed by user
