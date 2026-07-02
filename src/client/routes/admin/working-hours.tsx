import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { TopBar } from '@/components/layout/top-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAllTechnicians,
  usePutWorkingHours,
  useWorkingHours,
  type ApiError,
  type WorkingHourInput,
} from '@/lib/api'

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const DEFAULT_START = '09:00'
const DEFAULT_END = '18:00'

interface DayRow {
  enabled: boolean
  start: string
  end: string
}

function minToHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function buildInitialRows(entries: { weekday: number; startMin: number; endMin: number }[]): DayRow[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const entry = entries.find((e) => e.weekday === weekday)
    return entry
      ? { enabled: true, start: minToHM(entry.startMin), end: minToHM(entry.endMin) }
      : { enabled: false, start: DEFAULT_START, end: DEFAULT_END }
  })
}

export function WorkingHoursPage() {
  const techniciansQuery = useAllTechnicians()
  const technicians = techniciansQuery.data ?? []
  const [technicianId, setTechnicianId] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (technicianId === undefined && technicians.length > 0) {
      setTechnicianId(technicians[0].id)
    }
  }, [technicians, technicianId])

  const workingHoursQuery = useWorkingHours(technicianId)
  const putWorkingHours = usePutWorkingHours(technicianId)

  const [rows, setRows] = useState<DayRow[] | null>(null)
  const [loadedFor, setLoadedFor] = useState<number | undefined>(undefined)

  if (workingHoursQuery.data && loadedFor !== technicianId) {
    setRows(buildInitialRows(workingHoursQuery.data))
    setLoadedFor(technicianId)
  }

  function updateRow(weekday: number, patch: Partial<DayRow>) {
    setRows((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[weekday] = { ...next[weekday], ...patch }
      return next
    })
  }

  async function handleSave() {
    if (!rows || technicianId === undefined) return

    const entries: WorkingHourInput[] = []
    for (let weekday = 0; weekday < 7; weekday++) {
      const row = rows[weekday]
      if (!row.enabled) continue
      const startMin = hmToMin(row.start)
      const endMin = hmToMin(row.end)
      if (startMin >= endMin) {
        toast.error(`${WEEKDAY_LABELS[weekday]}: giờ bắt đầu phải trước giờ kết thúc`)
        return
      }
      entries.push({ weekday, startMin, endMin })
    }

    try {
      await putWorkingHours.mutateAsync(entries)
      toast.success('Đã lưu lịch làm việc')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Lưu thất bại')
    }
  }

  return (
    <>
      <TopBar title="Lịch làm việc" />

      <main className="flex-1 space-y-4 p-6">
        <Card>
          <CardContent className="space-y-4">
            <div className="max-w-xs space-y-1.5">
              <label className="text-sm font-medium text-foreground">Kỹ thuật viên</label>
              {techniciansQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Đang tải…</p>
              ) : technicians.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có kỹ thuật viên nào.</p>
              ) : (
                <Select
                  value={technicianId !== undefined ? String(technicianId) : undefined}
                  onValueChange={(v) => setTechnicianId(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn kỹ thuật viên" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {workingHoursQuery.error ? (
              <ErrorState message={workingHoursQuery.error.message} />
            ) : workingHoursQuery.isLoading || !rows ? (
              <LoadingState />
            ) : (
              <div className="space-y-2">
                {rows.map((row, weekday) => (
                  <div
                    key={weekday}
                    className="flex items-center gap-4 rounded-xl border border-border/60 px-4 py-3"
                  >
                    <div className="flex w-24 items-center gap-2">
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(checked) => updateRow(weekday, { enabled: checked })}
                      />
                      <span className="text-sm font-medium">{WEEKDAY_LABELS[weekday]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={row.start}
                        disabled={!row.enabled}
                        onChange={(e) => updateRow(weekday, { start: e.target.value })}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">đến</span>
                      <Input
                        type="time"
                        value={row.end}
                        disabled={!row.enabled}
                        onChange={(e) => updateRow(weekday, { end: e.target.value })}
                        className="w-32"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSave} disabled={putWorkingHours.isPending}>
                    {putWorkingHours.isPending ? 'Đang lưu…' : 'Lưu lịch làm việc'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      Đang tải…
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-medium text-destructive">Không tải được dữ liệu</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
