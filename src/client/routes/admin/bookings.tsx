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
import { useBookings, useCancelBooking, useUpdateBooking, type Booking } from '@/lib/api'
import { useMe } from '@/lib/auth-api'
import { todayISO, fmtRange } from '@/lib/time'
import { AuditDialog } from '@/components/admin/audit-dialog'
import { BookingDialog } from '@/components/admin/booking-dialog'

const PAYMENT_LABEL: Record<'unpaid' | 'paid', string> = {
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
}

const PAYMENT_COLORS: Record<'unpaid' | 'paid', { bg: string; text: string }> = {
  paid: { bg: '#dcfce7', text: '#166534' },
  unpaid: { bg: '#f3f4f6', text: '#4b5563' },
}

export function BookingsPage() {
  const [date, setDate] = useState(todayISO())
  const bookingsQuery = useBookings(date)
  const meQuery = useMe()
  const isAdmin = meQuery.data?.role === 'admin'

  const [auditBooking, setAuditBooking] = useState<Booking | null>(null)
  const [detailBookingId, setDetailBookingId] = useState<number | null>(null)

  const cancelBooking = useCancelBooking()
  const updateBooking = useUpdateBooking()

  const bookings = (bookingsQuery.data ?? []).slice().sort((a, b) => a.startMin - b.startMin)

  function handleCancel(b: Booking) {
    if (!window.confirm('Hủy lịch hẹn này?')) return
    cancelBooking.mutate(b.id)
  }

  function handleComplete(b: Booking) {
    updateBooking.mutate({ id: b.id, status: 'completed' })
  }

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
                    <TableHead>Thanh toán</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => {
                    const c = STATUS_COLORS[b.status]
                    const pc = PAYMENT_COLORS[b.paymentStatus]
                    const isFinal = b.status === 'cancelled' || b.status === 'completed'
                    return (
                      <TableRow
                        key={b.id}
                        className="cursor-pointer"
                        onClick={() => setDetailBookingId(b.id)}
                      >
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
                        <TableCell>
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ backgroundColor: pc.bg, color: pc.text }}
                          >
                            {PAYMENT_LABEL[b.paymentStatus]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!isFinal && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleComplete(b)}
                                disabled={updateBooking.isPending}
                              >
                                Hoàn thành
                              </Button>
                            )}
                            {!isFinal && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleCancel(b)}
                                disabled={cancelBooking.isPending}
                              >
                                Hủy
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailBookingId(b.id)}
                            >
                              Chi tiết
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Xem nhật ký"
                                onClick={() => setAuditBooking(b)}
                              >
                                <History className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
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

      <BookingDialog
        bookingId={detailBookingId}
        open={detailBookingId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailBookingId(null)
        }}
      />
    </>
  )
}
