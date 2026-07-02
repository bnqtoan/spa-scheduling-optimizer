# Task 07 — App Shell + Navigation (Phase 2, but only needs scaffold)

**Model/effort:** Sonnet / medium
**Depends on:** 00 (done). Blocks: 09,10,11. Runs in parallel with 01.

## Goal
Build the admin app shell: sidebar navigation + main layout + spa theme, with TanStack Router routes for all 8 screens (placeholder page bodies — later tasks fill them in). This is the visual skeleton that matches the mockup.

## Working dir
`/Users/bnqtoan/Documents/CCF/session-1-demo` (scaffold in place: React + Vite + TanStack Router + TanStack Query + Tailwind v4 + shadcn under `src/client`).

## Reference
Mockup (`Spa Scheduling Optimizer.pdf` and the dashboard image): left sidebar with brand "Serenity Spa / Lịch & Booking" + lotus icon, light warm background, purple/violet accent for the active nav item and primary buttons, soft rounded cards.

## 8 sidebar items → routes
| Label | Path | Icon (lucide) |
|---|---|---|
| Tổng quan | `/` | LayoutDashboard |
| Lịch đặt | `/bookings` | CalendarDays |
| Kỹ thuật viên | `/technicians` | Users |
| Dịch vụ | `/services` | Sparkles |
| Lịch làm việc | `/working-hours` | CalendarClock |
| Ngày nghỉ | `/time-off` | CalendarOff |
| Thống kê | `/stats` | BarChart3 |
| Cài đặt | `/settings` | Settings |

Also a **customer booking** route `/book` (public 5-step flow, task 10) — add the route stub but it does NOT use the admin sidebar shell (it's the customer-facing page). Keep admin routes under a shared layout with the sidebar; keep `/book` outside that layout.

## Do
1. Set up TanStack Router routes (file-based or code-based — match whatever the scaffold chose). Admin routes share a `<AppShell>` layout (sidebar + top bar area + `<Outlet/>`). `/book` is standalone.
2. Build `<Sidebar>`: brand block, nav list with active-state highlight (violet pill like mockup), lucide icons. Include the small "Mẹo sử dụng" hint card at the bottom (as in mockup).
3. Top bar: page title slot on the left, room on the right for actions (e.g. a "+ Tạo booking" button placeholder on dashboard, a bell icon). Keep it generic — pages provide their own header content.
4. Each of the 8 admin routes: a placeholder page component rendering its title (e.g. `<h1>Kỹ thuật viên</h1>` + "Coming soon") so navigation is testable. `/book` placeholder too.
5. Establish the spa theme via Tailwind/shadcn CSS variables: warm off-white background, violet primary (approx the mockup's purple `#7c3aed`-ish), soft borders, rounded-xl cards. Set it in the global css / shadcn theme tokens so later screens inherit it. Vietnamese UI text.
6. Make it responsive-ish (sidebar can be simple fixed-width on desktop; mobile collapse optional, not required for MVP).

## Constraints
- Placeholders only for page bodies — do NOT implement CRUD, timeline, charts, or the booking wizard (those are tasks 08–11).
- Reuse shadcn components (button, card, etc.) rather than hand-rolling.
- Do not touch `src/server`.

## Verify before done
- `npm run build` passes.
- `npm run dev` → clicking each sidebar item navigates and shows the right placeholder; active item is highlighted; `/book` renders standalone (no sidebar).
- Report: route table, where the theme tokens live, and a note on any shadcn components added.

## Checklist
- [ ] TanStack Router routes for 8 admin screens + `/book`
- [ ] Admin `<AppShell>` layout with sidebar + Outlet
- [ ] Sidebar: brand, nav w/ active highlight, lucide icons, tip card
- [ ] Top bar with title slot + actions area
- [ ] 8 placeholder pages + /book placeholder
- [ ] Spa theme tokens (warm bg, violet primary, rounded cards) applied globally
- [ ] Vietnamese labels
- [ ] `/book` standalone (no admin sidebar)
- [ ] `npm run build` passes; nav works in dev
- [ ] reported route table + theme location
