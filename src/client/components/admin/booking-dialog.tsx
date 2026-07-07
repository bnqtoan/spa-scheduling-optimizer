import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STATUS_COLORS, STATUS_LABEL } from '@/components/dashboard/status'
import {
  type ApiError,
  useBooking,
  useCancelBooking,
  useTechnicians,
  useUpdateBooking,
} from '@/lib/api'
import { fmtRange } from '@/lib/time'

const PAYMENT_LABEL: Record<'unpaid' | 'paid', string> = {
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
}

const PAYMENT_COLORS: Record<'unpaid' | 'paid', { bg: string; text: string }> = {
  paid: { bg: '#dcfce7', text: '#166534' },
  unpaid: { bg: '#f3f4f6', text: '#4b5563' },
}

/** Map a server ApiError (code or http status) to a Vietnamese message for the
 * reschedule/edit form. Falls back to the raw error message. */
function rescheduleErrorMessage(err: ApiError): string {
  switch (err.code) {
    case 'BUSINESS_SLOT_OVERLAP':
      return 'Trùng lịch — khung giờ này KTV đã có lịch hẹn khác'
    case 'VALIDATION_SKILL_MISMATCH':
      return 'KTV không có kỹ năng phù hợp với dịch vụ này'
    case 'VALIDATION_OUTSIDE_HOURS':
      return 'Ngoài giờ làm việc của KTV'
    case 'VALIDATION_TIME_OFF':
      return 'KTV nghỉ trong khung giờ này'
    default:
      break
  }
  if (err.status === 409) return 'Trùng lịch — khung giờ này KTV đã có lịch hẹn khác'
  if (err.status === 422) return 'Khung giờ không hợp lệ'
  return err.message || 'Không thể lưu thay đổi'
}

function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function BookingDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const bookingQuery = useBooking(open ? bookingId : null)
  const techniciansQuery = useTechnicians()
  const cancelBooking = useCancelBooking()
  const updateBooking = useUpdateBooking()

  const booking = bookingQuery.data

  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState('')
  const [startHHMM, setStartHHMM] = useState('')
  const [technicianId, setTechnicianId] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (booking) {
      setDate(booking.date)
      setStartHHMM(minToHHMM(booking.startMin))
      setTechnicianId(String(booking.technician.id))
    }
  }, [booking?.id, booking?.date, booking?.startMin, booking?.technician.id])

  useEffect(() => {
    if (!open) {
      setEditing(false)
      setFormError(null)
    }
  }, [open])

  const canAct = booking != null && booking.status === 'scheduled'

  function handleCancel() {
    if (!booking) return
    if (!window.confirm('Hủy lịch hẹn này?')) return
    cancelBooking.mutate(booking.id, { onSuccess: () => onOpenChange(false) })
  }

  function handleComplete() {
    if (!booking) return
    updateBooking.mutate(
      { id: booking.id, status: 'completed' },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  function handleSaveReschedule() {
    if (!booking) return
    setFormError(null)
    updateBooking.mutate(
      {
        id: booking.id,
        date,
        startMin: hhmmToMin(startHHMM),
        technicianId: Number(technicianId),
      },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => setFormError(rescheduleErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Chi tiết lịch hẹn{booking ? ` — ${booking.code}` : ''}
          </DialogTitle>
          <DialogDescription>Thông tin và thao tác trên lịch hẹn.</DialogDescription>
        </DialogHeader>

        {bookingQuery.isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
        )}
        {bookingQuery.isError && (
          <p className="py-8 text-center text-sm text-destructive">
            Không tải được lịch hẹn.
          </p>
        )}

        {booking && !editing && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: STATUS_COLORS[booking.status].bg,
                  color: STATUS_COLORS[booking.status].text,
                }}
              >
                {STATUS_LABEL[booking.status]}
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: PAYMENT_COLORS[booking.paymentStatus].bg,
                  color: PAYMENT_COLORS[booking.paymentStatus].text,
                }}
              >
                {PAYMENT_LABEL[booking.paymentStatus]}
              </span>
            </div>

            <dl className="grid grid-cols-3 gap-y-1.5">
              <dt className="text-muted-foreground">Khách hàng</dt>
              <dd className="col-span-2">{booking.customerName}</dd>
              {booking.customerPhone && (
                <>
                  <dt className="text-muted-foreground">Điện thoại</dt>
                  <dd className="col-span-2">{booking.customerPhone}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Dịch vụ</dt>
              <dd className="col-span-2">{booking.service.name}</dd>
              <dt className="text-muted-foreground">KTV</dt>
              <dd className="col-span-2">{booking.technician.name}</dd>
              <dt className="text-muted-foreground">Thời gian</dt>
              <dd className="col-span-2">
                {booking.date} · {fmtRange(booking.startMin, booking.endMin)}
              </dd>
              {booking.note && (
                <>
                  <dt className="text-muted-foreground">Ghi chú</dt>
                  <dd className="col-span-2">{booking.note}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {booking && editing && (
          <div className="space-y-3">
            {formError && (
              <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                {formError}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-date">Ngày</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-time">Giờ bắt đầu</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={startHHMM}
                onChange={(e) => setStartHHMM(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>KTV</Label>
              <Select value={technicianId} onValueChange={setTechnicianId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn KTV" />
                </SelectTrigger>
                <SelectContent>
                  {(techniciansQuery.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {booking && (
          <DialogFooter>
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Hủy chỉnh sửa
                </Button>
                <Button onClick={handleSaveReschedule} disabled={updateBooking.isPending}>
                  Lưu
                </Button>
              </>
            ) : (
              <>
                {canAct && (
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={cancelBooking.isPending}
                  >
                    Hủy lịch
                  </Button>
                )}
                {canAct && (
                  <Button
                    variant="outline"
                    onClick={handleComplete}
                    disabled={updateBooking.isPending}
                  >
                    Hoàn thành
                  </Button>
                )}
                {canAct && <Button onClick={() => setEditing(true)}>Đổi lịch</Button>}
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
