# Task 09 — Admin CRUD Screens (Phase 2)

**Model/effort:** Sonnet / medium
**Depends on:** 02,03,04,07,08 (done). Blocks: 12.

## Goal
Implement the 4 admin management screens, wired to the live APIs via TanStack Query: **Kỹ thuật viên** (technicians), **Dịch vụ** (services), **Lịch làm việc** (working hours), **Ngày nghỉ** (time off).

## Key facts (all live & verified)
- Shell + routes done (Task 07). Page components are placeholders at:
  `src/client/routes/admin/technicians.tsx`, `services.tsx`, `working-hours.tsx`, `time-off.tsx`.
- Query client + fetch wrapper exist: `src/client/lib/api.ts` (has `apiFetch`, `ApiError`, `queryKeys`, types Technician/Service/Skill/Booking, hooks useTechnicians/useServices). Time helpers in `src/client/lib/time.ts` (fmtHM etc.). **You own api.ts additions** (add mutation hooks here). Reuse the existing `apiFetch`.
- Theme: violet primary, warm bg, shadcn card/button already themed.

## Live API contracts
- **Technicians** `/api/technicians`: GET (list w/ skills[]), GET :id, POST {name,avatarUrl?,active?,skillIds?}, PATCH :id (same, skillIds replaces set), DELETE :id. **Skills** `/api/skills`: GET, POST {name}, DELETE :id.
- **Services** `/api/services`: GET (?active,?skillId; joined skill), POST {name,skillId,durationMin,price,active?}, PATCH :id, DELETE :id (soft-delete → active=false).
- **Schedule** `/api/schedule`: GET `/working-hours?technicianId=`; PUT `/working-hours/:technicianId` (body: [{weekday,startMin,endMin}]); GET `/time-off?technicianId=&from=&to=`; POST `/time-off` {technicianId,date,startMin?,endMin?,reason?}; DELETE `/time-off/:id`.
- Times = minutes-from-midnight; weekday 0=Sunday. VND prices are plain ints.

## Deliverable — implement the 4 screens
Use shadcn components (add via `npx shadcn add ...` as needed: table, dialog, form/input/select, label, badge, sonner/toast). Each screen: a list/table + create/edit via dialog + delete with confirm. Use TanStack Query mutations that invalidate the relevant query keys. Show loading + error + empty states. Vietnamese labels. Match the spa look.

1. **Kỹ thuật viên**: table (avatar/name, skills as badges, active). Add/edit dialog: name, active toggle, multi-select skills (from /api/skills). Delete confirm. Also allow managing the skills list (small section or a "Kỹ năng" sub-area) so skills can be created/removed.
2. **Dịch vụ**: table (name, skill, duration, price formatted as VND). Add/edit dialog: name, skill select, durationMin (number), price (number). Delete → soft-delete (row shows inactive or is filtered).
3. **Lịch làm việc**: pick a technician → edit their weekly hours (7 weekday rows, each with start/end time inputs in HH:MM converted to minutes). Save = PUT replace. Convention weekday 0=Sun..6=Sat; label in Vietnamese (CN, T2..T7).
4. **Ngày nghỉ**: pick technician (or all) → list time_off; add dialog (date picker, optional partial start/end, reason); delete. Whole-day if start/end omitted.

## api.ts additions (you own this file)
Add mutation hooks + any missing query hooks: useSkills, useCreate/Update/DeleteTechnician, useCreate/DeleteSkill, useCreate/Update/DeleteService, useWorkingHours(techId)+usePutWorkingHours, useTimeOff(filters)+useCreate/DeleteTimeOff. Keep types in sync with contracts above. Reuse existing apiFetch/queryKeys; extend queryKeys as needed.

## Constraints
- Only touch `src/client`. Do NOT edit src/server. Do NOT create a separate api client — extend the existing `src/client/lib/api.ts`.
- Another agent (Task 11) is adding `src/client/lib/stats-api.ts` and editing ONLY the stats/settings route files — you will not collide as long as you don't touch stats.tsx/settings.tsx or create stats-api.ts.

## Verify before done
- `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` passes.
- With `npm run dev` + worker running: create/edit/delete a technician, a service, set working hours, add a day off — confirm each persists (re-fetch shows the change) and errors surface.
- Report: files touched, shadcn components added, the api.ts hooks added, and a note on any contract mismatch found.

## Checklist
- [ ] Kỹ thuật viên screen: table + add/edit (skills multiselect) + delete; manage skills
- [ ] Dịch vụ screen: table + add/edit + soft-delete; VND formatting
- [ ] Lịch làm việc screen: per-tech weekly hours editor (HH:MM↔min), PUT replace
- [ ] Ngày nghỉ screen: list + add (whole/partial day) + delete
- [ ] api.ts mutation/query hooks added, keys invalidated
- [ ] loading/error/empty states; Vietnamese labels; spa styling
- [ ] tsc + build clean; CRUD persists live
- [ ] reported files/components/hooks/mismatches
