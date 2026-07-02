import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TopBar } from '@/components/layout/top-bar'
import { KpiCards, type Kpis } from '@/components/stats/kpi-cards'
import { BarChart, type BarDatum } from '@/components/stats/bar-chart'
import type { Booking } from '@/lib/api'
import { fmtDateLabelVi, todayISO } from '@/lib/time'
import { lastNDaysISO, useAllServices, useBookingsForRange, useBookingsForStats } from '@/lib/stats-api'
import { cn } from '@/lib/utils'

type RangeMode = 'today' | '7d'

function computeKpis(allBookings: Booking[], priceByServiceId: Map<number, number>, now: Date): Kpis {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const today = todayISO()

  let completed = 0
  let cancelled = 0
  let upcoming = 0
  let revenue = 0

  for (const b of allBookings) {
    if (b.status === 'completed') {
      completed++
      revenue += priceByServiceId.get(b.service.id) ?? 0
    } else if (b.status === 'cancelled') {
      cancelled++
    } else if (b.status === 'scheduled') {
      // "upcoming": hasn't started yet. For today that's relative to now; for
      // any other date in the range, all scheduled bookings count.
      if (b.date !== today || b.startMin >= nowMin) upcoming++
    }
  }

  return { total: allBookings.length, completed, cancelled, upcoming, revenue }
}

function technicianBarData(allBookings: Booking[]): BarDatum[] {
  const counts = new Map<string, number>()
  for (const b of allBookings) {
    if (b.status === 'cancelled') continue
    const name = b.technician?.name ?? 'Không rõ'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

function perDayBarData(dates: string[], perDayBookings: Booking[][]): BarDatum[] {
  return dates.map((date, i) => {
    const count = perDayBookings[i]?.filter((b) => b.status !== 'cancelled').length ?? 0
    const [, mo, d] = date.split('-')
    return { label: `${d}/${mo}`, value: count }
  })
}

export function StatsPage() {
  const [mode, setMode] = useState<RangeMode>('today')
  const today = todayISO()
  const rangeDates = useMemo(() => lastNDaysISO(7), [])

  const todayQuery = useBookingsForStats(today)
  const rangeQueries = useBookingsForRange(rangeDates)
  const servicesQuery = useAllServices()

  const isRange = mode === '7d'
  const isLoading = isRange
    ? rangeQueries.isLoading || servicesQuery.isLoading
    : todayQuery.isLoading || servicesQuery.isLoading
  const isError = isRange ? rangeQueries.isError || servicesQuery.isError : todayQuery.isError || servicesQuery.isError

  const allBookings: Booking[] = useMemo(() => {
    if (isRange) return rangeQueries.data?.flat() ?? []
    return todayQuery.data ?? []
  }, [isRange, rangeQueries.data, todayQuery.data])

  const priceByServiceId = useMemo(() => {
    const map = new Map<number, number>()
    for (const s of servicesQuery.data ?? []) map.set(s.id, s.price)
    return map
  }, [servicesQuery.data])

  const kpis = useMemo(
    () => computeKpis(allBookings, priceByServiceId, new Date()),
    [allBookings, priceByServiceId],
  )

  const techChartData = useMemo(() => technicianBarData(allBookings), [allBookings])
  const dayChartData = useMemo(
    () => (isRange ? perDayBarData(rangeDates, rangeQueries.data ?? []) : []),
    [isRange, rangeDates, rangeQueries.data],
  )

  const isEmpty = !isLoading && !isError && allBookings.length === 0

  return (
    <>
      <TopBar
        title="Thống kê"
        actions={
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            <Button
              variant={mode === 'today' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-full"
              onClick={() => setMode('today')}
            >
              Hôm nay
            </Button>
            <Button
              variant={mode === '7d' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-full"
              onClick={() => setMode('7d')}
            >
              7 ngày qua
            </Button>
          </div>
        }
      />
      <main className="flex-1 space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          {mode === 'today'
            ? fmtDateLabelVi(today)
            : `${fmtDateLabelVi(rangeDates[0])} – ${fmtDateLabelVi(rangeDates[rangeDates.length - 1])}`}
        </p>

        {isError && (
          <Card>
            <CardContent className="flex min-h-32 items-center justify-center text-sm text-destructive">
              Không tải được dữ liệu thống kê. Vui lòng thử lại.
            </CardContent>
          </Card>
        )}

        {!isError && <KpiCards kpis={kpis} loading={isLoading} />}

        {!isError && (
          <div className={cn('grid gap-4', isRange ? 'lg:grid-cols-2' : 'grid-cols-1')}>
            <Card>
              <CardHeader>
                <CardTitle>Booking theo kỹ thuật viên</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[180px] animate-pulse rounded-md bg-muted" />
                ) : isEmpty ? (
                  <p className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                    Chưa có booking nào trong khoảng thời gian này.
                  </p>
                ) : (
                  <BarChart data={techChartData} />
                )}
              </CardContent>
            </Card>

            {isRange && (
              <Card>
                <CardHeader>
                  <CardTitle>Booking theo ngày (7 ngày qua)</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-[180px] animate-pulse rounded-md bg-muted" />
                  ) : (
                    <BarChart data={dayChartData} barColor="var(--color-chart-2)" />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </>
  )
}
