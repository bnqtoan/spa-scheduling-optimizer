import { CalendarDays, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Booking } from '@/lib/api'
import { todayISO } from '@/lib/time'

export interface DayStats {
  total: number
  completed: number
  upcoming: number
  cancelled: number
}

/**
 * Derive counts from a day's bookings.
 * - total     = all bookings (incl. cancelled), matches mockup (6+8+4=18).
 * - completed = status 'completed'.
 * - cancelled = status 'cancelled'.
 * - upcoming  = status 'scheduled' that hasn't started yet. For today, "hasn't
 *   started" is relative to the current time-of-day; for any other date all
 *   scheduled bookings count as upcoming (no "now" reference on that day).
 */
export function computeStats(bookings: Booking[], now: Date = new Date()): DayStats {
  const isToday = bookings.length > 0 && bookings[0].date === todayISO()
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1

  let completed = 0
  let cancelled = 0
  let upcoming = 0
  for (const b of bookings) {
    if (b.status === 'completed') completed++
    else if (b.status === 'cancelled') cancelled++
    else if (b.status === 'scheduled' && b.startMin >= nowMin) upcoming++
  }
  return { total: bookings.length, completed, upcoming, cancelled }
}

export function StatsCard({ stats }: { stats: DayStats }) {
  const rows = [
    { label: 'Tổng booking', value: stats.total, Icon: CalendarDays, color: 'text-primary' },
    { label: 'Đã hoàn thành', value: stats.completed, Icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Sắp tới', value: stats.upcoming, Icon: Clock, color: 'text-amber-600' },
    { label: 'Đã hủy', value: stats.cancelled, Icon: XCircle, color: 'text-red-500' },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking hôm nay</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {rows.map(({ label, value, Icon, color }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/5"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={`size-3.5 ${color}`} />
              {label}
            </div>
            <span className="font-heading text-2xl font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
