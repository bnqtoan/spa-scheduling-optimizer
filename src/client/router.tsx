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

const rootRoute = createRootRoute()

// Admin routes share the <AppShell> layout (sidebar + top bar + Outlet).
const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin-layout',
  component: AppShell,
})

const dashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/',
  component: DashboardPage,
})

const bookingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/bookings',
  component: BookingsPage,
})

const techniciansRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/technicians',
  component: TechniciansPage,
})

const servicesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/services',
  component: ServicesPage,
})

const workingHoursRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/working-hours',
  component: WorkingHoursPage,
})

const timeOffRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/time-off',
  component: TimeOffPage,
})

const statsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/stats',
  component: StatsPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/settings',
  component: SettingsPage,
})

// Standalone customer-facing route, outside the admin shell.
const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/book',
  component: BookPage,
})

const routeTree = rootRoute.addChildren([
  adminLayoutRoute.addChildren([
    dashboardRoute,
    bookingsRoute,
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
