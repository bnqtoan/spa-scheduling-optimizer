# Task 08 — Dashboard Timeline (Tổng quan) (Phase 2)

**Model/effort:** Opus / high
**Depends on:** 00,07 (done). Best after 05 (bookings API) but can build UI against the API contract in parallel. Blocks: 12.

## Goal
Build the "Tổng quan" dashboard to match the mockup: a per-technician resource timeline (FullCalendar), a "Booking hôm nay" stats card, a "Booking sắp tới" list, and a "+ Tạo booking" action.

## Key facts (from completed tasks)
- App shell + routing done (Task 07): admin routes under `<AppShell>`; the dashboard page component is at `src/client/routes/admin/dashboard.tsx` (currently a placeholder). Spa theme tokens (violet primary) already global in `src/client/index.css`. TanStack Router + Query providers wired.
- FullCalendar packages already installed: `@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/resource`, `@fullcalendar/resource-timeline`, `@fullcalendar/interaction`.
- Bookings API (Task 05, may still be in progress) contract:
  - `GET /api/bookings?date=YYYY-MM-DD` → array of bookings, each with `{ id, code, date, startMin, endMin, status, customerName, technician: {id,name}, service: {id,name,durationMin} }`.
  - Technicians: `GET /api/technicians` → `[{ id, name, avatarUrl, skills:[{id,name}] }]`.
  - Times are minutes-from-midnight; convert to Date/time for FullCalendar.
- Working hours are 09:00–19:00 (slotMin/Max 09:00 / 19:00).

## Deliverable — implement `src/client/routes/admin/dashboard.tsx` (+ components under `src/client/components/dashboard/`)
1. **Resource timeline** (FullCalendar `resourceTimelineDay`): resources = technicians (rows, show name + subtitle of skills), events = that day's bookings positioned by startMin/endMin. slotMinTime 09:00, slotMaxTime 19:00, slot label per hour. Event content shows time range + service name; color events softly (pastel per service or per status) like the mockup. License: use the free `resource-timeline` (it's GPL/free for OSS — set `schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source'`).
2. **Date navigation**: "Hôm nay" button, prev/next arrows, a date display — drives the query (`?date=`). Use TanStack Query keyed by date.
3. **"Booking hôm nay" stats card** (right column): Tổng booking, Đã hoàn thành, Sắp tới, Đã hủy — computed from the day's bookings by status/time.
4. **"Booking sắp tới" list** (right column): next few upcoming bookings today (start time, service, customer, KTV), with a "Xem tất cả lịch đặt" link to `/bookings`.
5. **Top bar**: page title "Tổng quan" + a primary "+ Tạo booking" button. The button can route to `/book` or open a create dialog — for MVP, link/navigate is fine (the full create flow is Task 10). Wire it to `/book` or a stub dialog; document which.

## Data fetching
- Create a small typed API client hook layer under `src/client/lib/api.ts` (fetch wrapper) + TanStack Query hooks (`useBookings(date)`, `useTechnicians()`). Reuse these in later tasks. Base URL: same origin `/api/...` (dev proxy already set up in scaffold).
- Minutes→time helpers (e.g. `minToDate(dateISO, min)`, `fmtHM(min)`) in `src/client/lib/time.ts` — reusable.

## Constraints
- Only touch `src/client`. Do NOT edit `src/server`.
- Match the mockup's look (warm bg, violet accents, soft cards) using existing theme tokens + shadcn.
- If the bookings API isn't reachable yet during your dev, code against the contract above and verify with the build/typecheck; the Planner will run the live end-to-end.

## Verify before done
- `npm run build` + `npx tsc --noEmit` clean.
- If API is live: `npm run dev`, open `/`, confirm the seeded 7 bookings for today render across technician rows 09:00–19:00, stats card counts match, upcoming list populates.
- Report: files created, the api.ts/time.ts helper signatures (later tasks reuse), FullCalendar view config, and how the "+ Tạo booking" button is wired.

## Checklist
- [ ] api.ts fetch client + Query hooks (useBookings, useTechnicians)
- [ ] time.ts min↔time helpers
- [ ] FullCalendar resourceTimelineDay: techs as resources, bookings as events, 09:00–19:00
- [ ] date nav (Hôm nay / prev / next) drives query
- [ ] "Booking hôm nay" stats card (tổng/hoàn thành/sắp tới/hủy)
- [ ] "Booking sắp tới" list + link to /bookings
- [ ] top bar title + "+ Tạo booking" wired (documented)
- [ ] spa styling matches mockup
- [ ] build + tsc clean; live render verified if API up
- [ ] reported files/helpers/config/wiring
