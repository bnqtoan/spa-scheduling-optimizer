import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBookingPayment } from '@/lib/booking-api'

function fmtVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ'
}

/**
 * Step 5 — VietQR payment. Polls GET /bookings/:id/payment (refetchInterval
 * in useBookingPayment) until status flips to 'paid', then shows success.
 */
export function PaymentStep({
  bookingId,
  onDone,
}: {
  bookingId: number
  onDone: () => void
}) {
  const paymentQuery = useBookingPayment(bookingId)
  const payment = paymentQuery.data

  if (paymentQuery.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tạo mã thanh toán…</p>
      </div>
    )
  }

  if (paymentQuery.isError || !payment) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-sm text-destructive">
          Không tải được thông tin thanh toán. Vui lòng thử lại.
        </p>
        <Button variant="outline" onClick={() => void paymentQuery.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  if (payment.status === 'paid') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-9" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Thanh toán thành công!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cảm ơn bạn — hẹn gặp bạn tại spa.
          </p>
        </div>
        <Button size="lg" className="h-11 w-full text-sm" onClick={onDone}>
          Xong
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <p className="text-sm font-medium text-foreground">Quét mã để thanh toán</p>

      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <img
          src={payment.qrUrl}
          alt="Mã QR thanh toán VietQR"
          className="size-56 rounded-lg"
        />
      </div>

      <dl className="w-full divide-y divide-border rounded-xl border border-border bg-card text-left text-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-muted-foreground">Số tiền</dt>
          <dd className="font-semibold text-foreground">{fmtVnd(payment.amount)}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-muted-foreground">Nội dung chuyển khoản</dt>
          <dd className="font-mono font-medium text-foreground">{payment.paymentRef}</dd>
        </div>
      </dl>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        <span>Đang chờ xác nhận thanh toán…</span>
      </div>

      <Button variant="outline" size="lg" className="h-11 w-full text-sm" onClick={onDone}>
        Thanh toán sau
      </Button>
    </div>
  )
}
