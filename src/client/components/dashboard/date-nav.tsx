import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtDateLabelVi, shiftISO, todayISO } from '@/lib/time'

export function DateNav({
  date,
  onChange,
}: {
  date: string
  onChange: (date: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => onChange(todayISO())}>
        Hôm nay
      </Button>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Ngày trước"
          onClick={() => onChange(shiftISO(date, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Ngày sau"
          onClick={() => onChange(shiftISO(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <span className="ml-1 text-sm font-medium text-foreground">{fmtDateLabelVi(date)}</span>
    </div>
  )
}
