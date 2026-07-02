import { CheckCircle2, Clock, Loader2, Sparkles } from 'lucide-react'
import { useServices, type Service } from '@/lib/api'
import { cn } from '@/lib/utils'
import { fmtDuration, fmtVND } from './format'

/**
 * Step 1 — service picker. Grid of cards (name, duration, price). Clicking a
 * card selects it and advances (handled by `onSelect` in the parent).
 */
export function ServiceStep({
  selectedId,
  onSelect,
}: {
  selectedId: number | null
  onSelect: (service: Service) => void
}) {
  const { data, isLoading, isError, refetch } = useServices()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Đang tải dịch vụ…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Không tải được danh sách dịch vụ.
        </p>
        <button
          onClick={() => refetch()}
          className="text-sm font-medium text-primary hover:underline"
        >
          Thử lại
        </button>
      </div>
    )
  }

  const services = data.filter((s) => s.active)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {services.map((service) => {
        const active = service.id === selectedId
        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(service)}
            className={cn(
              'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'border-primary ring-1 ring-primary' : 'border-border',
            )}
          >
            {active && (
              <CheckCircle2 className="absolute top-3 right-3 size-5 text-primary" />
            )}
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-foreground">
                {service.name}
              </h3>
              {service.skill && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {service.skill.name}
                </p>
              )}
            </div>
            <div className="mt-auto flex items-center justify-between pt-1">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {fmtDuration(service.durationMin)}
              </span>
              <span className="font-semibold text-foreground">
                {fmtVND(service.price)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
