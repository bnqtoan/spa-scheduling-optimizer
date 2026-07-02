// Typed API client + TanStack Query hooks. Same-origin `/api/...`; the dev proxy
// (vite.config.ts) forwards to `wrangler dev`. Later tasks reuse these types/hooks.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Domain types (match server contracts)
// ---------------------------------------------------------------------------

export type BookingStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Skill {
  id: number
  name: string
}

export interface Technician {
  id: number
  name: string
  avatarUrl: string | null
  active: boolean
  skills: Skill[]
}

export interface Service {
  id: number
  name: string
  durationMin: number
  price: number
  active: boolean
  skillId: number
  skill: Skill | null
}

export interface Booking {
  id: number
  code: string
  date: string // YYYY-MM-DD
  startMin: number
  endMin: number
  status: BookingStatus
  customerName: string
  technician: { id: number; name: string }
  service: { id: number; name: string; durationMin: number }
}

export interface WorkingHourEntry {
  id: number
  technicianId: number
  weekday: number // 0=Sunday..6=Saturday
  startMin: number
  endMin: number
}

export interface TimeOffEntry {
  id: number
  technicianId: number
  date: string // YYYY-MM-DD
  startMin: number | null
  endMin: number | null
  reason: string | null
}

// ---------------------------------------------------------------------------
// fetch wrapper
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** GET/POST/... against `/api${path}`, JSON in/out, throws ApiError on non-2xx. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = typeof body.error === 'string' ? body.error : message
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  bookings: (date: string) => ['bookings', date] as const,
  technicians: () => ['technicians'] as const,
  skills: () => ['skills'] as const,
  services: () => ['services'] as const,
  workingHours: (technicianId: number) => ['working-hours', technicianId] as const,
  timeOff: (filters: { technicianId?: number; from?: string; to?: string }) =>
    ['time-off', filters] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Bookings for a single day (YYYY-MM-DD). Keyed by date. */
export function useBookings(date: string): UseQueryResult<Booking[], ApiError> {
  return useQuery({
    queryKey: queryKeys.bookings(date),
    queryFn: () => apiFetch<Booking[]>(`/bookings?date=${date}`),
  })
}

/** All active technicians with their skills. */
export function useTechnicians(): UseQueryResult<Technician[], ApiError> {
  return useQuery({
    queryKey: queryKeys.technicians(),
    queryFn: () => apiFetch<Technician[]>(`/technicians?active=true`),
  })
}

/** All technicians (active + inactive) with skills — for admin management. */
export function useAllTechnicians(): UseQueryResult<Technician[], ApiError> {
  return useQuery({
    queryKey: [...queryKeys.technicians(), 'all'],
    queryFn: () => apiFetch<Technician[]>(`/technicians`),
  })
}

/** All services. */
export function useServices(): UseQueryResult<Service[], ApiError> {
  return useQuery({
    queryKey: queryKeys.services(),
    queryFn: () => apiFetch<Service[]>(`/services`),
  })
}

/** All services (active + inactive) — for admin management. */
export function useAllServices(): UseQueryResult<Service[], ApiError> {
  return useQuery({
    queryKey: [...queryKeys.services(), 'all'],
    queryFn: () => apiFetch<Service[]>(`/services?active=false`).then(async (inactive) => {
      const active = await apiFetch<Service[]>(`/services?active=true`)
      return [...active, ...inactive]
    }),
  })
}

/** All skills. */
export function useSkills(): UseQueryResult<Skill[], ApiError> {
  return useQuery({
    queryKey: queryKeys.skills(),
    queryFn: () => apiFetch<Skill[]>(`/skills`),
  })
}

// ---------------------------------------------------------------------------
// Technician mutations
// ---------------------------------------------------------------------------

export interface TechnicianInput {
  name: string
  avatarUrl?: string | null
  active?: boolean
  skillIds?: number[]
}

function invalidateTechnicians(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.technicians() })
}

export function useCreateTechnician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TechnicianInput) =>
      apiFetch<Technician>(`/technicians`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTechnicians(queryClient),
  })
}

export function useUpdateTechnician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: TechnicianInput & { id: number }) =>
      apiFetch<Technician>(`/technicians/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTechnicians(queryClient),
  })
}

export function useDeleteTechnician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/technicians/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateTechnicians(queryClient),
  })
}

// ---------------------------------------------------------------------------
// Skill mutations
// ---------------------------------------------------------------------------

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Skill>(`/skills`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.skills() }),
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: true }>(`/skills/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills() })
      invalidateTechnicians(queryClient)
    },
  })
}

// ---------------------------------------------------------------------------
// Service mutations
// ---------------------------------------------------------------------------

export interface ServiceInput {
  name: string
  skillId: number
  durationMin: number
  price: number
  active?: boolean
}

function invalidateServices(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.services() })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      apiFetch<Service>(`/services`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateServices(queryClient),
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ServiceInput> & { id: number }) =>
      apiFetch<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => invalidateServices(queryClient),
  })
}

/** Soft-delete (active=false). */
export function useDeleteService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/services/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateServices(queryClient),
  })
}

// ---------------------------------------------------------------------------
// Schedule: working hours
// ---------------------------------------------------------------------------

export function useWorkingHours(technicianId: number | undefined): UseQueryResult<WorkingHourEntry[], ApiError> {
  return useQuery({
    queryKey: queryKeys.workingHours(technicianId ?? -1),
    queryFn: () => apiFetch<WorkingHourEntry[]>(`/schedule/working-hours?technicianId=${technicianId}`),
    enabled: technicianId !== undefined,
  })
}

export interface WorkingHourInput {
  weekday: number
  startMin: number
  endMin: number
}

/** PUT replace the full weekly schedule for a technician. */
export function usePutWorkingHours(technicianId: number | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entries: WorkingHourInput[]) =>
      apiFetch<WorkingHourEntry[]>(`/schedule/working-hours/${technicianId}`, {
        method: 'PUT',
        body: JSON.stringify(entries),
      }),
    onSuccess: () => {
      if (technicianId !== undefined) {
        queryClient.invalidateQueries({ queryKey: queryKeys.workingHours(technicianId) })
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Schedule: time off
// ---------------------------------------------------------------------------

export interface TimeOffFilters {
  technicianId?: number
  from?: string
  to?: string
}

export function useTimeOff(filters: TimeOffFilters): UseQueryResult<TimeOffEntry[], ApiError> {
  return useQuery({
    queryKey: queryKeys.timeOff(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.technicianId !== undefined) params.set('technicianId', String(filters.technicianId))
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      const qs = params.toString()
      return apiFetch<TimeOffEntry[]>(`/schedule/time-off${qs ? `?${qs}` : ''}`)
    },
  })
}

export interface TimeOffInput {
  technicianId: number
  date: string
  startMin?: number
  endMin?: number
  reason?: string
}

export function useCreateTimeOff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TimeOffInput) =>
      apiFetch<TimeOffEntry>(`/schedule/time-off`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off'] }),
  })
}

export function useDeleteTimeOff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/schedule/time-off/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off'] }),
  })
}
