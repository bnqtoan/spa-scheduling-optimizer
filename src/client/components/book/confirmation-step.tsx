import { CalendarDays, CheckCircle2, Clock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtDateLabelVi, fmtRange } from '@/lib/time'
import type { CreatedBooking } from '@/lib/booking-api'

/**
 * Step 5 — success screen. The booking code is displayed prominently, followed
 * by a summary (service, technician, time, customer). "Đặt lịch mới" resets the
 * whole wizard.
 */
export function ConfirmationStep({
  booking,
  onReset,
}: {
  booking: CreatedBooking
  onReset: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-9" />
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold text-foreground">
          Đặt lịch thành công!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chúng tôi rất mong được đón tiếp {booking.customerName}.
        </p>
      </div>

      <div className="w-full rounded-xl border border-dashed border-primary/40 bg-accent/40 px-4 py-4">
        <p className="text-xs font-medium text-muted-foreground">Mã đặt lịch</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-primary">
          {booking.code}
        </p>
      </div>

      <dl className="w-full divide-y divide-border rounded-xl border border-border bg-card text-left text-sm">
        <SummaryRow
          icon={<CalendarDays className="size-4" />}
          label="Ngày"
          value={fmtDateLabelVi(booking.date)}
        />
        <SummaryRow
          icon={<Clock className="size-4" />}
          label="Thời gian"
          value={`${fmtRange(booking.startMin, booking.endMin)} · ${booking.service.name}`}
        />
        <SummaryRow
          icon={<User className="size-4" />}
          label="Kỹ thuật viên"
          value={booking.technician.name}
        />
        <SummaryRow
          icon={<User className="size-4" />}
          label="Khách hàng"
          value={booking.customerName}
        />
      </dl>

      <Button
        variant="outline"
        size="lg"
        className="h-11 w-full text-sm"
        onClick={onReset}
      >
        Đặt lịch mới
      </Button>
    </div>
  )
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium text-foreground">{value}</dd>
      </div>
    </div>
  )
}
