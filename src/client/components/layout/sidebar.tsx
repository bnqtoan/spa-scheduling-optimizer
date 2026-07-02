import { Link, useRouterState } from '@tanstack/react-router'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Tổng quan', to: '/', icon: LayoutDashboard },
  { label: 'Lịch đặt', to: '/bookings', icon: CalendarDays },
  { label: 'Kỹ thuật viên', to: '/technicians', icon: Users },
  { label: 'Dịch vụ', to: '/services', icon: Sparkles },
  { label: 'Lịch làm việc', to: '/working-hours', icon: CalendarClock },
  { label: 'Ngày nghỉ', to: '/time-off', icon: CalendarOff },
  { label: 'Thống kê', to: '/stats', icon: BarChart3 },
  { label: 'Cài đặt', to: '/settings', icon: Settings },
] as const

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

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
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
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

      <div className="mt-4 rounded-xl bg-accent/60 p-3 text-accent-foreground">
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
