import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface CustomerInfo {
  name: string
  phone: string
  note: string
}

/**
 * Step 4 — customer details. Name + phone required; note optional. "Tiếp tục"
 * (labelled "Xác nhận đặt lịch") submits → triggers the create-booking
 * mutation in the parent. `errorMessage` surfaces non-409 create failures.
 */
export function CustomerStep({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  value: CustomerInfo
  onChange: (next: CustomerInfo) => void
  onSubmit: () => void
  isSubmitting: boolean
  errorMessage: string | null
}) {
  const nameOk = value.name.trim().length > 0
  // Vietnamese phone: 9–11 digits (allow spaces the user might type).
  const digits = value.phone.replace(/\D/g, '')
  const phoneOk = digits.length >= 9 && digits.length <= 11
  const valid = nameOk && phoneOk

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !isSubmitting) onSubmit()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cust-name">
          Họ và tên <span className="text-destructive">*</span>
        </Label>
        <Input
          id="cust-name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Nguyễn Thị A"
          autoComplete="name"
          className="h-10"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cust-phone">
          Số điện thoại <span className="text-destructive">*</span>
        </Label>
        <Input
          id="cust-phone"
          type="tel"
          inputMode="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder="09xx xxx xxx"
          autoComplete="tel"
          className="h-10"
          required
        />
        {value.phone.length > 0 && !phoneOk && (
          <p className="text-xs text-destructive">
            Số điện thoại chưa hợp lệ.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cust-note">Ghi chú (không bắt buộc)</Label>
        <Textarea
          id="cust-note"
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="Yêu cầu đặc biệt, dị ứng, ưu tiên kỹ thuật viên…"
          rows={3}
        />
      </div>

      {errorMessage && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full text-sm"
        disabled={!valid || isSubmitting}
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Xác nhận đặt lịch
      </Button>
    </form>
  )
}
