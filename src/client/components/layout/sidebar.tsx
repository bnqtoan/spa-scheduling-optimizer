import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Sparkles,
  CalendarClock,
  CalendarOff,
  BarChart3,
  Settings,
  Flower2,
  Lightbulb,
  LogOut,
  CalendarCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLogout, useMe, type UserRole } from '@/lib/auth-api'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan', to: '/', icon: LayoutDashboard, roles: ['admin', 'receptionist'] },
  { label: 'Lịch đặt', to: '/bookings', icon: CalendarDays, roles: ['admin', 'receptionist'] },
  { label: 'Lịch của tôi', to: '/my-schedule', icon: CalendarCheck, roles: ['technician'] },
  { label: 'Kỹ thuật viên', to: '/technicians', icon: Users, roles: ['admin'] },
  { label: 'Dịch vụ', to: '/services', icon: Sparkles, roles: ['admin'] },
  { label: 'Lịch làm việc', to: '/working-hours', icon: CalendarClock, roles: ['admin'] },
  { label: 'Ngày nghỉ', to: '/time-off', icon: CalendarOff, roles: ['admin'] },
  { label: 'Thống kê', to: '/stats', icon: BarChart3, roles: ['admin'] },
  { label: 'Cài đặt', to: '/settings', icon: Settings, roles: ['admin'] },
]

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const meQuery = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const role = meQuery.data?.role

  const items = NAV_ITEMS.filter((item) => !role || item.roles.includes(role))

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => void navigate({ to: '/login' }),
    })
  }

  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Flower2 className="size-5" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-heading text-sm font-semibold text-sidebar-foreground">
            Serenity Spa
          </span>
          <span className="text-xs text-muted-foreground">Lịch &amp; Booking</span>
        </div>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const isActive =
            item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to as '/'}
              className={cn(
                'flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {meQuery.data && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/60 p-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {meQuery.data.username}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {ROLE_LABEL[meQuery.data.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            aria-label="Đăng xuất"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-accent/60 p-3 text-accent-foreground">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Lightbulb className="size-4" />
          <span>Mẹo sử dụng</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-accent-foreground/80">
          Dùng mục &ldquo;Lịch đặt&rdquo; để xem timeline theo kỹ thuật viên và tránh trùng lịch.
        </p>
      </div>
    </aside>
  )
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  receptionist: 'Lễ tân',
  technician: 'Kỹ thuật viên',
}
