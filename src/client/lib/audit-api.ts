// Admin audit-trail data hook (Phase 2). Reuses `apiFetch`. Admin-only server
// route (403 for other roles) — callers should only render the trigger for
// role==='admin'.

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type ApiError } from '@/lib/api'

export interface AuditEntry {
  id: number
  bookingId: number
  userId: number | null
  username: string | null
  action: string
  oldValues: unknown
  newValues: unknown
  createdAt: string
}

export function useBookingAudit(
  bookingId: number | null,
): UseQueryResult<AuditEntry[], ApiError> {
  return useQuery({
    queryKey: ['audit', 'booking', bookingId],
    queryFn: () => apiFetch<AuditEntry[]>(`/bookings/${bookingId}/audit`),
    enabled: bookingId !== null,
  })
}
