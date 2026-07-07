import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPage } from '@/routes/admin/dashboard'
import { BookingsPage } from '@/routes/admin/bookings'
import { TechniciansPage } from '@/routes/admin/technicians'
import { ServicesPage } from '@/routes/admin/services'
import { WorkingHoursPage } from '@/routes/admin/working-hours'
import { TimeOffPage } from '@/routes/admin/time-off'
import { StatsPage } from '@/routes/admin/stats'
import { SettingsPage } from '@/routes/admin/settings'
import { BookPage } from '@/routes/book/book-page'
import { LoginPage } from '@/routes/auth/login-page'
import { MySchedulePage } from '@/routes/technician/my-schedule'
import { RequireAuth } from '@/components/auth/require-auth'

const rootRoute = createRootRoute()

// Public login route, outside the admin shell.
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// Admin/staff routes share the <AppShell> layout (sidebar + top bar + Outlet),
// guarded: unauthenticated -> /login. Individual routes further restrict by role.
const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin-layout',
  component: () => (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  ),
})

// Dashboard/bookings: admin + receptionist.
const dashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/',
  component: () => (
    <RequireAuth roles={['admin', 'receptionist']}>
      <DashboardPage />
    </RequireAuth>
  ),
})

const bookingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/bookings',
  component: () => (
    <RequireAuth roles={['admin', 'receptionist']}>
      <BookingsPage />
    </RequireAuth>
  ),
})

// KTV-only: their own schedule.
const myScheduleRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/my-schedule',
  component: () => (
    <RequireAuth roles={['technician']}>
      <MySchedulePage />
    </RequireAuth>
  ),
})

// Admin-only management screens.
const techniciansRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/technicians',
  component: () => (
    <RequireAuth roles={['admin']}>
      <TechniciansPage />
    </RequireAuth>
  ),
})

const servicesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/services',
  component: () => (
    <RequireAuth roles={['admin']}>
      <ServicesPage />
    </RequireAuth>
  ),
})

const workingHoursRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/working-hours',
  component: () => (
    <RequireAuth roles={['admin']}>
      <WorkingHoursPage />
    </RequireAuth>
  ),
})

const timeOffRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/time-off',
  component: () => (
    <RequireAuth roles={['admin']}>
      <TimeOffPage />
    </RequireAuth>
  ),
})

const statsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/stats',
  component: () => (
    <RequireAuth roles={['admin']}>
      <StatsPage />
    </RequireAuth>
  ),
})

const settingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/settings',
  component: () => (
    <RequireAuth roles={['admin']}>
      <SettingsPage />
    </RequireAuth>
  ),
})

// Standalone customer-facing route, outside the admin shell — public, no auth.
const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/book',
  component: BookPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  adminLayoutRoute.addChildren([
    dashboardRoute,
    bookingsRoute,
    myScheduleRoute,
    techniciansRoute,
    servicesRoute,
    workingHoursRoute,
    timeOffRoute,
    statsRoute,
    settingsRoute,
  ]),
  bookRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
