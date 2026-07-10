import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useBookings, useTechnicians } from '@/lib/api'
import { todayISO } from '@/lib/time'
import { DateNav } from '@/components/dashboard/date-nav'
import { TimelineCalendar } from '@/components/dashboard/timeline-calendar'
import { StatsCard, computeStats } from '@/components/dashboard/stats-card'
import { UpcomingList } from '@/components/dashboard/upcoming-list'
import { BookingDialog } from '@/components/admin/booking-dialog'

export function DashboardPage() {
  const [date, setDate] = useState(todayISO())
  const [detailBookingId, setDetailBookingId] = useState<number | null>(null)

  const techniciansQuery = useTechnicians()
  const bookingsQuery = useBookings(date)

  const technicians = techniciansQuery.data ?? []
  const bookings = bookingsQuery.data ?? []
  const stats = computeStats(bookings)

  const isLoading = techniciansQuery.isLoading || bookingsQuery.isLoading
  const error = techniciansQuery.error ?? bookingsQuery.error

  return (
    <>
      <TopBar
        title="Tổng quan"
        actions={
          // MVP: navigate to the customer booking flow (/book). The full admin
          // create-dialog is Task 10.
          <Button size="sm" asChild>
            <Link to="/book">
              <Plus className="size-4" />
              Tạo booking
            </Link>
          </Button>
        }
      />

      <main className="flex-1 space-y-4 p-6">
        <DateNav date={date} onChange={setDate} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          {/* Timeline */}
          <Card className="min-w-0">
            <CardContent className="min-w-0">
              {error ? (
                <ErrorState message={error.message} />
              ) : isLoading ? (
                <LoadingState />
              ) : technicians.length === 0 ? (
                <EmptyState message="Chưa có kỹ thuật viên nào." />
              ) : (
                <TimelineCalendar
                  date={date}
                  technicians={technicians}
                  bookings={bookings}
                  onEventClick={setDetailBookingId}
                />
              )}
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-4">
            <StatsCard stats={stats} />
            <UpcomingList bookings={bookings} />
          </div>
        </div>
      </main>

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

function LoadingState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      Đang tải lịch…
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-medium text-destructive">Không tải được dữ liệu</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
