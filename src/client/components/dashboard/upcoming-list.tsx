import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Booking } from '@/lib/api'
import { fmtHM } from '@/lib/time'
import { STATUS_COLORS } from './status'

/** Scheduled bookings, soonest first, capped. */
export function pickUpcoming(bookings: Booking[], limit = 5): Booking[] {
  return bookings
    .filter((b) => b.status === 'scheduled')
    .sort((a, b) => a.startMin - b.startMin)
    .slice(0, limit)
}

export function UpcomingList({ bookings }: { bookings: Booking[] }) {
  const items = pickUpcoming(bookings)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking sắp tới</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Không có booking sắp tới
          </p>
        ) : (
          items.map((b) => {
            const c = STATUS_COLORS[b.status]
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5 ring-1 ring-foreground/5"
              >
                <div
                  className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-md text-xs font-semibold"
                  style={{ backgroundColor: c.bg, color: c.text }}
                >
                  {fmtHM(b.startMin)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {b.service.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {b.customerName} · KTV {b.technician.name}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <Link
          to="/bookings"
          className="mt-1 inline-flex items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Xem tất cả lịch đặt
          <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  )
}
