// Lightweight, dependency-free SVG bar chart. No charting lib needed for a
// handful of bars (per-technician / per-day counts).

export interface BarDatum {
  label: string
  value: number
}

export function BarChart({
  data,
  height = 180,
  valueFormatter,
  barColor = 'var(--color-primary)',
}: {
  data: BarDatum[]
  height?: number
  valueFormatter?: (v: number) => string
  barColor?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const fmt = valueFormatter ?? ((v: number) => String(v))

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Không có dữ liệu
      </div>
    )
  }

  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1" style={{ height }}>
      {data.map((d) => {
        const pct = Math.max(2, Math.round((d.value / max) * 100))
        return (
          <div key={d.label} className="flex h-full min-w-14 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-medium text-foreground">{fmt(d.value)}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-[height]"
                style={{ height: `${pct}%`, backgroundColor: barColor, minHeight: 4 }}
                aria-hidden
              />
            </div>
            <span className="max-w-16 truncate text-center text-[0.7rem] text-muted-foreground" title={d.label}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
