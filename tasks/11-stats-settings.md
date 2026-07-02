# Task 11 — Thống kê + Cài đặt (Phase 2)

**Model/effort:** Sonnet / medium
**Depends on:** 05,07,08 (done). Blocks: 12.

## Goal
Implement the **Thống kê** (stats) and **Cài đặt** (settings) screens.

## Key facts
- Shell + routes done. Placeholders at `src/client/routes/admin/stats.tsx` and `src/client/routes/admin/settings.tsx`.
- Existing helpers: `src/client/lib/api.ts` (apiFetch, ApiError, types Booking/Technician/Service, queryKeys) and `src/client/lib/time.ts` (fmtHM). **DO NOT edit api.ts** (Task 09 owns it in parallel). Instead create `src/client/lib/stats-api.ts` for any stats-specific fetching, reusing the exported `apiFetch` from api.ts.
- Theme: violet primary, warm bg, shadcn card themed.

## Live API contracts (read-only use)
- `GET /api/bookings?date=YYYY-MM-DD` → bookings for a day (with technician{id,name}, service{id,name,durationMin,...}, status scheduled|completed|cancelled, startMin/endMin, price is on service via /api/services).
- `GET /api/technicians`, `GET /api/services` available.
- There is NO dedicated stats/aggregate endpoint. Compute stats client-side by fetching the needed day(s) of bookings. For a date-range view, fetch each date in the range (keep the range small, e.g. last 7 days) OR just implement a single-day + a 7-day summary. Keep it simple for MVP.

## Deliverable
1. **Thống kê** screen:
   - A date or date-range selector (default: today / last 7 days).
   - KPI cards: total bookings, completed, cancelled, upcoming, and revenue estimate (sum of service.price for completed bookings — join booking.service to services list for price, since /api/bookings service may not include price; fetch /api/services and map by id).
   - At least one chart (use a lightweight approach — recharts if you add it, or simple CSS/SVG bars; do NOT pull a heavy lib if a simple bar chart suffices). Suggested: bookings per technician, or bookings per day over the range, or revenue per service.
   - Vietnamese labels, spa styling, loading/empty states.
2. **Cài đặt** screen:
   - Since PRD MVP has no auth/multi-tenant, keep this light but real: business info display (spa name "Serenity Spa"), default working window display (09:00–19:00), slot granularity note (15 min), and links to manage technicians/services/working-hours (route to those screens). A simple read-only/info settings page with a few editable-looking fields is acceptable for MVP — clearly a settings surface, not empty.

## Constraints
- Only touch `src/client/routes/admin/stats.tsx`, `src/client/routes/admin/settings.tsx`, and NEW files you create (e.g. `src/client/lib/stats-api.ts`, `src/client/components/stats/*`). 
- DO NOT edit `src/client/lib/api.ts` (Task 09 owns it) or any CRUD screen files or src/server.
- If you add a chart lib, `npm install` it; keep bundle reasonable.

## Verify before done
- `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` passes.
- With dev + worker: stats screen shows correct counts for the seeded day (7 bookings today), revenue computed; settings renders.
- Report: files created, whether you added a chart lib (which), and how revenue is computed.

## Checklist
- [ ] Thống kê: date/range selector
- [ ] KPI cards (total/completed/cancelled/upcoming/revenue)
- [ ] at least one chart
- [ ] Cài đặt: business info + working window + links to management screens
- [ ] stats-api.ts (reuses apiFetch; api.ts untouched)
- [ ] Vietnamese, spa styling, loading/empty states
- [ ] tsc + build clean; correct counts on seeded day
- [ ] reported files/chart-lib/revenue-calc
