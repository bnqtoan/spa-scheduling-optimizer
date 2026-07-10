# Task 22 — Booking actions UI for staff (Phase 3) (Nhóm A)

**Model/effort:** Sonnet / medium (Opus/high for the reschedule dialog if needed)
**Depends on:** Phase 2 UI (bookings page, api layer), Task 21 (secured endpoints — so mutations require staff auth, which these UIs already have). Can run after or parallel to 21.

## Goal
Expose the booking-lifecycle capabilities the backend already supports but the UI has no trigger for: **cancel**, **mark completed**, **detail + reschedule/edit**, and **payment status visibility** for staff. Target the staff-facing bookings views. UI language: Vietnamese, match existing shadcn/ui style.

## Backend endpoints (already exist, Phase 2)
- `DELETE /api/bookings/:id` — cancel (soft, staff-only) → `{ok,status:'cancelled'}`.
- `PATCH /api/bookings/:id` — staff-only; body any of `{status,technicianId,serviceId,date,startMin,customerName,customerPhone,note}`. Use `status:'completed'` for mark-complete; date/startMin/technicianId for reschedule (re-validates slot, 409 on overlap, 422 on skill/hours/time_off). 
- `GET /api/bookings/:id` — single booking (joined) for the detail dialog.
- `GET /api/bookings/:id/payment` — `{paymentRef,amount,status,qrUrl}` for payment status.
- Note: the `Booking` type in `src/client/lib/api.ts` currently lacks `paymentStatus` — the list endpoint DOES return it (schema has bookings.paymentStatus). Add it to the type so the list can show a paid/unpaid badge without an extra call.

## Deliverables (client only)
1. **api hooks** (`src/client/lib/booking-api.ts` or api.ts): `useCancelBooking()` (DELETE), `useUpdateBooking()` (PATCH), `useBooking(id)` (GET :id). Invalidate the bookings query on success. Add `paymentStatus` to the `Booking` type.
2. **Bookings table (`src/client/routes/admin/bookings.tsx`)** — per row, staff actions:
   - **Hủy** (cancel) button → confirm dialog ("Hủy lịch hẹn này?") → useCancelBooking. Hide/disable if already cancelled/completed.
   - **Hoàn thành** (mark completed) button → PATCH status='completed'. Show only for scheduled.
   - **Payment badge**: "Đã thanh toán" (paid, green) / "Chưa thanh toán" (unpaid, gray) from `booking.paymentStatus`.
   - Row click or a "Chi tiết" button → **booking detail dialog**.
3. **Booking detail dialog** (`src/client/components/admin/booking-dialog.tsx`) — shows full info (customer, phone, service, KTV, time, code, status, payment status + paymentRef), and offers:
   - **Đổi lịch** (reschedule): edit date/startMin and/or technician → PATCH. Surface 409/422 errors as Vietnamese messages ("Trùng lịch", "Ngoài giờ làm việc", …) from the `{error:{code}}` shape.
   - Cancel + mark-completed also available here.
   - (Reuse the existing AuditDialog trigger if present.)
4. **Dashboard timeline**: wire `eventClick` on the FullCalendar timeline (`TimelineCalendar`) to open the same booking detail dialog. (If risky, at minimum make bookings table fully actionable; timeline click is a bonus — do it if clean.)

## Constraints
- Client only. Reuse existing components/dialogs, apiFetch, error-code→Vietnamese mapping. Match visual style. Keep changes additive.
- Guard actions by role: cancel/complete/reschedule are staff (admin+receptionist) — these views are already staff-gated by RequireAuth, but disable actions for technician if any such view reuses these components.
- Don't touch server code.

## Verify before done
- `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` ok.
- Live smoke (dev, seeded, browser): login letan → /bookings shows a day with bookings → **Hủy** a scheduled booking → it moves to cancelled (confirm via refetch); **Hoàn thành** another → status completed; open **Chi tiết** → reschedule to a free slot succeeds, reschedule to an occupied slot shows "Trùng lịch"; payment badge reflects paid vs unpaid. (Use 2026-07-02 seed data.)
- Report: hooks added, components added/edited, the reschedule error-mapping, screenshots/click-path, tsc+build results.

## Checklist
- [ ] hooks: useCancelBooking, useUpdateBooking, useBooking(id) + paymentStatus on Booking type
- [ ] bookings table: Hủy + Hoàn thành buttons (state-aware) + payment badge
- [ ] booking detail dialog with reschedule/edit (409/422 → Vietnamese) + cancel/complete
- [ ] dashboard timeline eventClick → detail dialog (if clean)
- [ ] tsc app + build clean; live browser smoke (cancel/complete/reschedule/payment badge) passes
