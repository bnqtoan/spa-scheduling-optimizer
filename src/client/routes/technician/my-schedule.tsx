import { useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { Card, CardContent } from '@/components/ui/card'
import { DateNav } from '@/components/dashboard/date-nav'
import { useBookings } from '@/lib/api'
import { todayISO, fmtRange } from '@/lib/time'
import { STATUS_COLORS, STATUS_LABEL } from '@/components/dashboard/status'

/**
 * KTV "Lịch của tôi" — the server already scopes GET /bookings?date= to the
 * caller's own technicianId for role=technician, so this is a plain list of
 * whatever `useBookings` returns; no client-side filtering needed.
 */
export function MySchedulePage() {
  const [date, setDate] = useState(todayISO())
  const bookingsQuery = useBookings(date)
  const bookings = (bookingsQuery.data ?? []).slice().sort((a, b) => a.startMin - b.startMin)

  return (
    <>
      <TopBar title="Lịch của tôi" actions={<DateNav date={date} onChange={setDate} />} />
      <main className="flex-1 p-6">
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            {bookingsQuery.isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
            )}
            {bookingsQuery.isError && (
              <p className="py-8 text-center text-sm text-destructive">
                Không tải được lịch. Vui lòng thử lại.
              </p>
            )}
            {!bookingsQuery.isLoading && bookings.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Không có lịch hẹn nào trong ngày này
              </p>
            )}
            {bookings.map((b) => {
              const c = STATUS_COLORS[b.status]
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5"
                >
                  <div
                    className="flex h-11 w-20 shrink-0 flex-col items-center justify-center rounded-md text-xs font-semibold"
                    style={{ backgroundColor: c.bg, color: c.text }}
                  >
                    {fmtRange(b.startMin, b.endMin)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {b.service.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {b.customerName} · {b.code}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: c.bg, color: c.text }}
                  >
                    {STATUS_LABEL[b.status]}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
