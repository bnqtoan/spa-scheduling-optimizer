import { useState } from 'react'
import { History } from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { DateNav } from '@/components/dashboard/date-nav'
import { STATUS_COLORS, STATUS_LABEL } from '@/components/dashboard/status'
import { useBookings, type Booking } from '@/lib/api'
import { useMe } from '@/lib/auth-api'
import { todayISO, fmtRange } from '@/lib/time'
import { AuditDialog } from '@/components/admin/audit-dialog'

export function BookingsPage() {
  const [date, setDate] = useState(todayISO())
  const bookingsQuery = useBookings(date)
  const meQuery = useMe()
  const isAdmin = meQuery.data?.role === 'admin'

  const [auditBooking, setAuditBooking] = useState<Booking | null>(null)

  const bookings = (bookingsQuery.data ?? []).slice().sort((a, b) => a.startMin - b.startMin)

  return (
    <>
      <TopBar title="Lịch đặt" actions={<DateNav date={date} onChange={setDate} />} />
      <main className="flex-1 p-6">
        <Card>
          <CardContent className="p-0">
            {bookingsQuery.isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
            )}
            {bookingsQuery.isError && (
              <p className="py-8 text-center text-sm text-destructive">
                Không tải được danh sách lịch đặt.
              </p>
            )}
            {!bookingsQuery.isLoading && bookings.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Không có lịch đặt nào trong ngày này
              </p>
            )}
            {bookings.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Dịch vụ</TableHead>
                    <TableHead>KTV</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    {isAdmin && <TableHead className="text-right">Nhật ký</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => {
                    const c = STATUS_COLORS[b.status]
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.code}</TableCell>
                        <TableCell>{fmtRange(b.startMin, b.endMin)}</TableCell>
                        <TableCell>{b.customerName}</TableCell>
                        <TableCell>{b.service.name}</TableCell>
                        <TableCell>{b.technician.name}</TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ backgroundColor: c.bg, color: c.text }}
                          >
                            {STATUS_LABEL[b.status]}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Xem nhật ký"
                              onClick={() => setAuditBooking(b)}
                            >
                              <History className="size-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <AuditDialog
        bookingId={auditBooking?.id ?? null}
        bookingCode={auditBooking?.code}
        open={auditBooking !== null}
        onOpenChange={(open) => {
          if (!open) setAuditBooking(null)
        }}
      />
    </>
  )
}
