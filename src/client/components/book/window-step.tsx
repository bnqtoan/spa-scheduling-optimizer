import { Clock, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fmtDateLabelVi, fmtHM } from '@/lib/time'
import type { Service } from '@/lib/api'
import { fmtDuration, fmtVND, hhmmToMin } from './format'

export interface WindowValue {
  date: string // YYYY-MM-DD
  fromHHMM: string // "HH:MM"
  toHHMM: string // "HH:MM"
}

/**
 * Step 2 — desired window picker. Shows the chosen service, then a date +
 * from/to time inputs. "Tìm lịch trống" is disabled until the window is valid
 * (from < to). Emits the window to the parent which converts to minutes.
 */
export function WindowStep({
  service,
  value,
  onChange,
  onSearch,
}: {
  service: Service
  value: WindowValue
  onChange: (next: WindowValue) => void
  onSearch: () => void
}) {
  const fromMin = hhmmToMin(value.fromHHMM)
  const toMin = hhmmToMin(value.toHHMM)
  const windowInvalid = !(fromMin < toMin)
  const tooShort = !windowInvalid && toMin - fromMin < service.durationMin

  return (
    <div className="flex flex-col gap-6">
      {/* Chosen service summary */}
      <div className="flex items-center justify-between rounded-xl bg-accent/40 p-4 ring-1 ring-primary/15">
        <div>
          <p className="text-xs font-medium text-primary">Dịch vụ đã chọn</p>
          <p className="font-heading text-base font-semibold text-foreground">
            {service.name}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {fmtDuration(service.durationMin)}
          </p>
        </div>
        <span className="font-semibold text-foreground">
          {fmtVND(service.price)}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="book-date">Ngày mong muốn</Label>
          <Input
            id="book-date"
            type="date"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            className="h-10"
          />
          {value.date && (
            <p className="text-xs text-muted-foreground">
              {fmtDateLabelVi(value.date)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="book-from">Từ</Label>
            <Input
              id="book-from"
              type="time"
              step={900}
              value={value.fromHHMM}
              onChange={(e) => onChange({ ...value, fromHHMM: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="book-to">Đến</Label>
            <Input
              id="book-to"
              type="time"
              step={900}
              value={value.toHHMM}
              onChange={(e) => onChange({ ...value, toHHMM: e.target.value })}
              className="h-10"
            />
          </div>
        </div>

        {windowInvalid ? (
          <p className="text-xs text-destructive">
            Giờ kết thúc phải sau giờ bắt đầu.
          </p>
        ) : tooShort ? (
          <p className="text-xs text-destructive">
            Khoảng thời gian ngắn hơn thời lượng dịch vụ (
            {fmtDuration(service.durationMin)}). Vui lòng mở rộng khung giờ.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tìm lịch trống trong khoảng {fmtHM(fromMin)}–{fmtHM(toMin)}.
          </p>
        )}
      </div>

      <Button
        size="lg"
        className="h-11 w-full text-sm"
        disabled={windowInvalid || tooShort || !value.date}
        onClick={onSearch}
      >
        <Search className="size-4" />
        Tìm lịch trống
      </Button>
    </div>
  )
}
