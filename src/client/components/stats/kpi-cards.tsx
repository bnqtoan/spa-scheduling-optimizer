import { CalendarCheck2, CalendarClock, CircleDollarSign, ListChecks, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface Kpis {
  total: number
  completed: number
  cancelled: number
  upcoming: number
  revenue: number
}

function fmtVND(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)
}

export function KpiCards({ kpis, loading }: { kpis: Kpis; loading?: boolean }) {
  const cards = [
    { label: 'Tổng booking', value: kpis.total, Icon: ListChecks, color: 'text-primary' },
    { label: 'Đã hoàn thành', value: kpis.completed, Icon: CalendarCheck2, color: 'text-emerald-600' },
    { label: 'Sắp tới', value: kpis.upcoming, Icon: CalendarClock, color: 'text-amber-600' },
    { label: 'Đã hủy', value: kpis.cancelled, Icon: XCircle, color: 'text-red-500' },
    { label: 'Doanh thu ước tính', value: fmtVND(kpis.revenue), Icon: CircleDollarSign, color: 'text-violet-600' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(({ label, value, Icon, color }) => (
        <Card key={label}>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={cn('size-3.5', color)} />
              {label}
            </div>
            {loading ? (
              <div className="h-7 w-16 animate-pulse rounded-md bg-muted" />
            ) : (
              <span className="font-heading text-2xl font-semibold text-foreground">{value}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
