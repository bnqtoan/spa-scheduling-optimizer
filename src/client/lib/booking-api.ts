// Customer booking flow data hooks. Reuses `apiFetch` from lib/api.ts (owned by
// Task 09 — do NOT edit that file). This module holds the two contracts the
// public /book wizard needs: the slot-suggestion query and the create-booking
// mutation. Query keys are namespaced ('suggest'/'booking') to avoid touching
// api.ts's queryKeys.

import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type ApiError } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types (match server contracts for /slots/suggest and POST /bookings)
// ---------------------------------------------------------------------------

/** Per-slot ranking breakdown from the suggestion engine (0..1 each). */
export interface SlotBreakdown {
  proximity: number
  load: number
  gap: number
}

/** One ranked suggestion: a technician + concrete time window + score. */
export interface SuggestedSlot {
  technicianId: number
  technicianName: string
  startMin: number
  endMin: number
  score: number
  breakdown: SlotBreakdown
}

/** GET /slots/suggest response. `slots` is empty when nothing qualifies. */
export interface SuggestResponse {
  service: { id: number; name: string; durationMin: number }
  slots: SuggestedSlot[]
}

/** Params for a suggestion query. `from`/`to` are minutes-from-midnight. */
export interface SuggestParams {
  serviceId: number
  date: string // YYYY-MM-DD
  from: number
  to: number
  limit: number
}

/** POST /bookings request body. endMin is derived server-side — never sent. */
export interface CreateBookingInput {
  technicianId: number
  serviceId: number
  date: string // YYYY-MM-DD
  startMin: number
  customerName: string
  customerPhone: string
  note?: string
}

/** POST /bookings 201 response (booking + resolved technician/service + code). */
export interface CreatedBooking {
  id: number
  code: string
  date: string
  startMin: number
  endMin: number
  status: string
  customerName: string
  technician: { id: number; name: string }
  service: { id: number; name: string; durationMin: number }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export const bookingQueryKeys = {
  suggest: (p: SuggestParams) =>
    ['suggest', p.serviceId, p.date, p.from, p.to, p.limit] as const,
}

/**
 * Ranked slot suggestions for a (service, date, window). Pass `enabled: false`
 * until the user has completed step 2 and reached step 3 so it doesn't fire
 * with a null/partial param set. Not cached across sessions (staleTime 0) so
 * "Xem thêm" / retry-after-409 always reflects fresh availability.
 */
export function useSuggestSlots(
  params: SuggestParams | null,
  enabled: boolean,
): UseQueryResult<SuggestResponse, ApiError> {
  return useQuery({
    queryKey: params
      ? bookingQueryKeys.suggest(params)
      : ['suggest', 'idle'],
    queryFn: () => {
      const p = params! // guarded by `enabled`
      const qs = new URLSearchParams({
        serviceId: String(p.serviceId),
        date: p.date,
        from: String(p.from),
        to: String(p.to),
        limit: String(p.limit),
      })
      return apiFetch<SuggestResponse>(`/slots/suggest?${qs.toString()}`)
    },
    enabled: enabled && params !== null,
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * Create a booking. On success returns the persisted booking incl. `code`.
 * A 409 (double_booking) surfaces as an ApiError with status 409 — the caller
 * handles it by sending the user back to step 3 and refetching suggestions.
 */
export function useCreateBooking() {
  return useMutation<CreatedBooking, ApiError, CreateBookingInput>({
    mutationFn: (input) =>
      apiFetch<CreatedBooking>('/bookings', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  })
}

// ---------------------------------------------------------------------------
// Payment (Phase 2) — GET /bookings/:id/payment, polled until status='paid'
// ---------------------------------------------------------------------------

export type PaymentStatus = 'pending' | 'paid' | 'failed'

export interface PaymentInfo {
  paymentRef: string
  amount: number
  status: PaymentStatus
  qrUrl: string
}

/**
 * Payment info for a booking's VietQR display. Polls every 3s (refetchInterval)
 * until `status === 'paid'`, then stops — used by the wizard's payment step to
 * flip to a success state once the SePay webhook reconciles.
 */
export function useBookingPayment(
  bookingId: number | null,
): UseQueryResult<PaymentInfo, ApiError> {
  return useQuery({
    queryKey: ['payment', bookingId],
    queryFn: () => apiFetch<PaymentInfo>(`/bookings/${bookingId}/payment`),
    enabled: bookingId !== null,
    refetchInterval: (query) => (query.state.data?.status === 'paid' ? false : 3000),
  })
}
