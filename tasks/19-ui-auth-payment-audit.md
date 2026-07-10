# Task 19 — UI: login, KTV "my schedule", payment/QR, audit view (Phase 2) (all)

**Model/effort:** Sonnet / medium (Opus/high for the payment-in-wizard step if tricky)
**Depends on:** 15 (auth API), 16 (RBAC + audit endpoint), 17 (payment endpoint/QR), 18. Blocks: 20.

## Goal
Front-end for the Phase-2 features: a login screen, an auth-aware shell (role-based nav), a KTV "Lịch của tôi" view, the payment step (VietQR) in the booking flow, and an admin audit-trail view. UI language: Vietnamese. Match existing shadcn/ui + Tailwind v4 style.

## Key facts
- Client: `src/client` — React + TanStack Router (`src/client/router.tsx`, code-based) + TanStack Query. Data layer: `src/client/lib/api.ts` (shared `apiFetch` + hooks), feature files `booking-api.ts`, `stats-api.ts`. Time formatting: `src/client/lib/time.ts`.
- API now has: `POST /api/auth/login|logout`, `GET /api/auth/me`; booking list/schedule are RBAC-filtered server-side (technician auto-scoped); `GET /api/bookings/:id/payment` (paymentRef, amount, status, qrUrl); admin audit list endpoint (path from Task 16).
- Cookie is HTTP-only → the client CANNOT read it. Auth state = `GET /api/auth/me` (401 = logged out). Use a TanStack Query `me` query as the auth source of truth.

## Deliverables
1. **Auth layer** `src/client/lib/auth-api.ts` (reuse `apiFetch`): `useMe()`, `useLogin()`, `useLogout()`. On 401 anywhere, `apiFetch` should surface it so guarded routes redirect to `/login` (coordinate: add a lightweight 401 handling in api.ts if not present — minimal).
2. **Login page** `/login` — username+password form, error on bad creds (`AUTH_UNAUTHORIZED` → "Sai tên đăng nhập hoặc mật khẩu"), redirect to home on success. Add route in router.tsx.
3. **Auth-aware shell** — nav shows items by role: admin (everything incl. Audit + Users if present), receptionist (bookings, schedule, create), technician (only "Lịch của tôi"). Show current user + logout. Guard admin/staff routes: redirect to /login if `me` is 401; block technician from admin screens.
4. **KTV "Lịch của tôi"** `/my-schedule` — for role=technician; lists their bookings (server already scopes to their technicianId). Reuse existing schedule/timeline components if feasible, filtered.
5. **Payment step in booking flow** — after a booking is created in the `/book` wizard, show the VietQR (`qrUrl` from the payment endpoint) + paymentRef + amount + "Quét mã để thanh toán". Poll `GET /api/bookings/:id/payment` (TanStack Query refetchInterval) until `status==='paid'`, then show success. Handle "chưa thanh toán" state gracefully.
6. **Admin audit view** — a page/panel listing audit entries for a booking (or recent) — who/action/when/old→new. Reachable from a booking's detail for admin.

## Constraints
- Own client files: `src/client/lib/auth-api.ts`, new route components under `src/client/routes/`, and `router.tsx` additions. You MAY minimally edit `api.ts` for 401 handling and reuse existing components. Coordinate with Planner if editing shared shell/nav — prefer additive.
- Do NOT touch server code. Keep Vietnamese copy. Match existing visual style (don't restyle the app).

## Verify before done
- `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` succeeds.
- Live smoke (all via running dev): login as admin → see full nav + audit; login as ktv1 → see ONLY "Lịch của tôi" with tech-1 bookings; complete a booking in `/book` → QR shows; simulate paid (webhook) → UI flips to success; logout → guarded route redirects to /login.
- Report: routes added, auth-state approach (me query), payment-polling approach, screenshots or exact click-path.

## Checklist
- [ ] auth-api.ts (useMe/useLogin/useLogout) + 401 handling
- [ ] /login page + redirect
- [ ] role-based nav + route guards (admin/receptionist/technician)
- [ ] /my-schedule for KTV (own bookings only)
- [ ] payment QR step in /book wizard with status polling
- [ ] admin audit view
- [ ] tsc app clean; build ok; full role + payment live smoke passes
