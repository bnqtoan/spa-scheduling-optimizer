// Stats-specific data fetching. Reuses `apiFetch` from lib/api.ts (owned by
// Task 09 — do not edit that file from here). There is no aggregate/stats
// endpoint on the server, so this module fetches raw bookings per day and
// the services list, then aggregates client-side.

import { useQueries, useQuery } from '@tanstack/react-query'
import { apiFetch, type Booking, type Service } from '@/lib/api'
import { shiftISO, todayISO } from '@/lib/time'

// lib/api.ts's `Service` type omits `price` (not needed by other screens).
// The server does return it (see src/server/routes/services.ts flattenSkill),
// so we extend it locally for revenue computation instead of editing api.ts.
export interface ServiceWithPrice extends Service {
  price: number
}

// ---------------------------------------------------------------------------
// Query keys (namespaced separately from lib/api.ts's queryKeys to avoid
// touching that file)
// ---------------------------------------------------------------------------

export const statsQueryKeys = {
  bookingsForDate: (date: string) => ['bookings', date] as const, // same shape as api.ts's key -> shares cache
  servicesFull: () => ['services'] as const,
}

// The default GET /bookings (no status) excludes cancelled. We need ALL
// statuses (scheduled + completed + cancelled) for full stats, so fetch each
// status explicitly and merge — simplest way to get cancelled rows too
// without changing server behavior.
async function fetchBookingsForDate(date: string): Promise<Booking[]> {
  const [scheduled, completed, cancelled] = await Promise.all([
    apiFetch<Booking[]>(`/bookings?date=${date}&status=scheduled`),
    apiFetch<Booking[]>(`/bookings?date=${date}&status=completed`),
    apiFetch<Booking[]>(`/bookings?date=${date}&status=cancelled`),
  ])
  return [...scheduled, ...completed, ...cancelled]
}

/** Full list of services (id -> price/name/duration), for revenue joins. */
export function useAllServices() {
  return useQuery({
    queryKey: statsQueryKeys.servicesFull(),
    queryFn: () => apiFetch<ServiceWithPrice[]>('/services'),
  })
}

/** All bookings (every status) for a single day. */
export function useBookingsForStats(date: string) {
  return useQuery({
    queryKey: statsQueryKeys.bookingsForDate(date),
    queryFn: () => fetchBookingsForDate(date),
  })
}

/** Last N days (inclusive of today), oldest first. */
export function lastNDaysISO(n: number, todayOverride?: string): string[] {
  const today = todayOverride ?? todayISO()
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(shiftISO(today, -i))
  }
  return days
}

/** Bookings (every status) for each date in `dates`, in the same order. */
export function useBookingsForRange(dates: string[]) {
  return useQueries({
    queries: dates.map((date) => ({
      queryKey: statsQueryKeys.bookingsForDate(date),
      queryFn: () => fetchBookingsForDate(date),
    })),
    combine: (results) => ({
      data: results.every((r) => r.data !== undefined)
        ? (results.map((r) => r.data) as Booking[][])
        : undefined,
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  })
}
