import { useEffect, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMe, type UserRole } from '@/lib/auth-api'

/**
 * Route guard: waits for `me`, redirects to /login if unauthenticated, and
 * (when `roles` given) redirects home if the user's role isn't allowed —
 * e.g. blocking a technician from admin-only screens.
 */
export function RequireAuth({
  roles,
  children,
}: {
  roles?: UserRole[]
  children: ReactNode
}) {
  const meQuery = useMe()
  const navigate = useNavigate()

  const user = meQuery.data
  const forbidden = !!user && !!roles && !roles.includes(user.role)

  useEffect(() => {
    if (meQuery.isLoading) return
    if (!user) {
      void navigate({ to: '/login' })
      return
    }
    if (forbidden) {
      void navigate({ to: '/' })
    }
  }, [meQuery.isLoading, user, forbidden, navigate])

  if (meQuery.isLoading || !user || forbidden) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Đang tải…
      </div>
    )
  }

  return <>{children}</>
}
