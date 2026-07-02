# Task 10 — Customer Booking Flow (CORE UX, 5-step wizard) (Phase 2)

**Model/effort:** Opus / high
**Depends on:** 03,05,06,07 (done). Blocks: 12.

## Goal
Build the customer-facing 5-step booking wizard at `/book` — the flow shown in the mockup's bottom panel. This is the product's core user journey and it consumes the slot-suggestion engine.

## The 5 steps (from mockup)
1. **Chọn dịch vụ** — grid of service cards (name, duration, price). Select one.
2. **Chọn khoảng thời gian mong muốn** — show chosen service; pick a date + a desired time window (from–to, e.g. 14:00–18:00). A "Tìm lịch trống" button.
3. **Xem gợi ý lịch trống** — call the suggestion API; show ranked suggestions (each: technician, time range, and a "Phù hợp nhất" badge on the top result). "Chọn" to pick one. A "Xem thêm lịch trống" to raise limit.
4. **Thông tin khách hàng** — họ tên, số điện thoại, ghi chú (optional). "Tiếp tục".
5. **Xác nhận đặt lịch** — success screen with booking code (e.g. SPA240525-0012), service, technician, time, customer. "Đặt lịch mới" resets.

Left rail: a vertical stepper (1..5) with the current step highlighted, matching the mockup.

## Key facts (all live & verified)
- `/book` route exists as a standalone page (outside the admin shell) — `src/client/routes/book/book-page.tsx` (placeholder). Spa theme (violet) global. TanStack Query wired.
- Existing helpers: `src/client/lib/api.ts` (apiFetch, ApiError, types Service, Technician) and `lib/time.ts` (fmtHM: minutes→"HH:MM"). **DO NOT edit api.ts** (Task 09 owns it in parallel). Create `src/client/lib/booking-api.ts` for suggest + create-booking, reusing the exported `apiFetch`.

## Live API contracts
- `GET /api/services` → `[{id,name,skillId,durationMin,price,active,skill:{id,name}}]` (filter active).
- `GET /api/slots/suggest?serviceId=&date=YYYY-MM-DD&from=&to=&limit=` →
  `{ service:{id,name,durationMin}, slots:[ {technicianId, technicianName, startMin, endMin, score, breakdown:{proximity,load,gap}} ] }`. Empty `slots:[]` if none qualify. `from`/`to` are minutes-from-midnight; window from<to.
- `POST /api/bookings` body `{technicianId, serviceId, date, startMin, customerName, customerPhone, note?}` → 201 `{...booking, code, technician:{id,name}, service:{id,name,durationMin}}`. **endMin is derived server-side — do not send it.** Errors: 409 double_booking (slot taken since suggestion — handle gracefully: tell user to pick another), 422 validation, 400 bad body.

## Deliverable
- `src/client/routes/book/book-page.tsx` — the wizard (local state machine for step + selections; or small useReducer). Keep the customer page clean/inviting (this is public-facing).
- `src/client/lib/booking-api.ts` — `useSuggestSlots(params)` (query, enabled when step 3 + params set) and `useCreateBooking()` (mutation). Reuse apiFetch.
- Components under `src/client/components/book/` as needed (service picker, window picker, suggestion list, customer form, confirmation, stepper).
- Time inputs: let the user pick from/to as HH:MM (selects or inputs) → convert to minutes for the API. Default window e.g. 09:00–19:00 or a sensible slice.
- On step 3, mark the highest-score slot with a "Phù hợp nhất" badge. Show time as HH:MM–HH:MM and the technician name.
- On confirm (step 5), display the returned `code` prominently.
- Handle the 409 case: if create fails with 409, surface "Rất tiếc, khung giờ vừa được đặt — vui lòng chọn lại" and send the user back to step 3 (refetch suggestions).

## Constraints
- Only touch `src/client/routes/book/*`, new `src/client/lib/booking-api.ts`, and new `src/client/components/book/*`.
- DO NOT edit `src/client/lib/api.ts` (Task 09 owns it), the admin screens, dashboard, stats/settings, or src/server.
- Reuse shadcn components already present (card, button, input, select, label) — add more only if needed.

## Verify before done
- `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` passes.
- With dev + worker: walk the full flow — pick "Massage thư giãn", date today, window 14:00–18:00 → suggestions appear ranked (top = "Phù hợp nhất") → pick one → fill name/phone → confirm → a booking code shows. Then verify the booking actually persisted (`GET /api/bookings?date=today` includes it). Test the 409 path if feasible.
- Report: files created, booking-api.ts hook signatures, and confirmation the end-to-end create worked (with the code you got).

## Checklist
- [ ] 5-step wizard with left stepper, current-step highlight
- [ ] Step 1 service cards (name/duration/price), select
- [ ] Step 2 date + desired window (HH:MM↔min), "Tìm lịch trống"
- [ ] Step 3 ranked suggestions from /api/slots/suggest, "Phù hợp nhất" on top, "Chọn", "Xem thêm"
- [ ] Step 4 customer form (name/phone/note)
- [ ] Step 5 confirmation with booking code; "Đặt lịch mới" resets
- [ ] booking-api.ts (useSuggestSlots, useCreateBooking) reusing apiFetch; api.ts untouched
- [ ] 409 handled gracefully (back to step 3)
- [ ] tsc + build clean; full flow creates a persisted booking live
- [ ] reported files/hooks/e2e-code
