import { CalendarX2, Loader2, Sparkles, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { ApiError } from '@/lib/api'
import type { SuggestResponse, SuggestedSlot } from '@/lib/booking-api'

/**
 * Step 3 — ranked suggestions from /slots/suggest. The top (highest-score) slot
 * gets a "Phù hợp nhất" badge. "Chọn" picks a slot; "Xem thêm lịch trống" asks
 * the parent to raise the limit and refetch. The parent owns the query.
 */
export function SuggestionsStep({
  query,
  onPick,
  onShowMore,
  canShowMore,
  isFetchingMore,
}: {
  query: {
    data: SuggestResponse | undefined
    isLoading: boolean
    isError: boolean
    error: ApiError | null
    refetch: () => void
  }
  onPick: (slot: SuggestedSlot) => void
  onShowMore: () => void
  canShowMore: boolean
  isFetchingMore: boolean
}) {
  const { data, isLoading, isError, refetch } = query

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Đang tìm lịch trống…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Có lỗi khi tìm lịch trống. Vui lòng thử lại.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  const slots = data?.slots ?? []

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarX2 className="size-6" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            Không có lịch trống trong khung giờ này
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vui lòng quay lại và chọn ngày hoặc khung giờ khác.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {slots.map((slot, i) => {
        const isBest = i === 0
        return (
          <div
            key={`${slot.technicianId}-${slot.startMin}`}
            className={cn(
              'flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
              isBest ? 'border-primary ring-1 ring-primary/40' : 'border-border',
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full',
                  isBest
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary',
                )}
              >
                <User className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {slot.technicianName}
                  </span>
                  {isBest && (
                    <Badge className="gap-1">
                      <Sparkles className="size-3" />
                      Phù hợp nhất
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {fmtRange(slot.startMin, slot.endMin)}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              variant={isBest ? 'default' : 'outline'}
              className="h-10 sm:w-28"
              onClick={() => onPick(slot)}
            >
              Chọn
            </Button>
          </div>
        )
      })}

      {canShowMore && (
        <Button
          variant="ghost"
          className="mt-1 h-10 w-full text-primary"
          onClick={onShowMore}
          disabled={isFetchingMore}
        >
          {isFetchingMore && <Loader2 className="size-4 animate-spin" />}
          Xem thêm lịch trống
        </Button>
      )}
    </div>
  )
}
