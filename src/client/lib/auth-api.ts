// Auth data hooks (Phase 2). Reuses `apiFetch` from lib/api.ts. Auth state is
// entirely derived from the `me` query — the session cookie is HttpOnly so JS
// cannot read it directly; a 401 on `me` means "logged out".

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type ApiError } from '@/lib/api'

export type UserRole = 'admin' | 'receptionist' | 'technician'

export interface AuthUser {
  id: number
  username: string
  role: UserRole
  technicianId: number | null
}

export const authQueryKeys = {
  me: () => ['auth', 'me'] as const,
}

/**
 * Current authenticated user. 401 (ApiError with status 401) means logged
 * out — treated as a normal "no user" result, not a query error, so guarded
 * routes can check `data === null` without fighting react-query retries.
 */
export function useMe(): UseQueryResult<AuthUser | null, ApiError> {
  return useQuery({
    queryKey: authQueryKeys.me(),
    queryFn: async () => {
      try {
        const res = await apiFetch<{ user: AuthUser }>('/auth/me')
        return res.user
      } catch (err) {
        if (err instanceof Error && (err as ApiError).status === 401) return null
        throw err
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

export interface LoginInput {
  username: string
  password: string
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation<{ user: AuthUser }, ApiError, LoginInput>({
    mutationFn: (input) =>
      apiFetch<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(authQueryKeys.me(), res.user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(authQueryKeys.me(), null)
      queryClient.clear()
    },
  })
}
