import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/layout/top-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useAllTechnicians,
  useCreateTimeOff,
  useDeleteTimeOff,
  useTimeOff,
  type ApiError,
  type TimeOffEntry,
} from '@/lib/api'
import { fmtHM, todayISO } from '@/lib/time'

const ALL_TECHNICIANS = 'all'

export function TimeOffPage() {
  const techniciansQuery = useAllTechnicians()
  const technicians = techniciansQuery.data ?? []

  const [filterId, setFilterId] = useState<string>(ALL_TECHNICIANS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<TimeOffEntry | null>(null)

  const timeOffQuery = useTimeOff(
    filterId === ALL_TECHNICIANS ? {} : { technicianId: Number(filterId) },
  )
  const deleteTimeOff = useDeleteTimeOff()

  const entries = [...(timeOffQuery.data ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))

  function technicianName(id: number) {
    return technicians.find((t) => t.id === id)?.name ?? `#${id}`
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteTimeOff.mutateAsync(deleting.id)
      toast.success('Đã xoá ngày nghỉ')
      setDeleting(null)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Xoá thất bại')
    }
  }

  return (
    <>
      <TopBar
        title="Ngày nghỉ"
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={technicians.length === 0}>
            <Plus className="size-4" />
            Thêm ngày nghỉ
          </Button>
        }
      />

      <main className="flex-1 space-y-4 p-6">
        <Card>
          <CardContent className="space-y-4">
            <div className="max-w-xs space-y-1.5">
              <label className="text-sm font-medium text-foreground">Kỹ thuật viên</label>
              <Select value={filterId} onValueChange={setFilterId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TECHNICIANS}>Tất cả</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {timeOffQuery.error ? (
              <ErrorState message={timeOffQuery.error.message} />
            ) : timeOffQuery.isLoading ? (
              <LoadingState />
            ) : entries.length === 0 ? (
              <EmptyState message="Chưa có ngày nghỉ nào." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Kỹ thuật viên</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.date}</TableCell>
                      <TableCell>{technicianName(e.technicianId)}</TableCell>
                      <TableCell>
                        {e.startMin === null || e.endMin === null ? (
                          <Badge variant="secondary">Cả ngày</Badge>
                        ) : (
                          <Badge variant="outline">
                            {fmtHM(e.startMin)} – {fmtHM(e.endMin)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.reason || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(e)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <TimeOffDialog open={dialogOpen} onOpenChange={setDialogOpen} technicians={technicians} />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá ngày nghỉ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Hành động này không thể hoàn tác.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteTimeOff.isPending}>
              {deleteTimeOff.isPending ? 'Đang xoá…' : 'Xoá'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Add dialog
// ---------------------------------------------------------------------------

function TimeOffDialog({
  open,
  onOpenChange,
  technicians,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  technicians: { id: number; name: string }[]
}) {
  const createTimeOff = useCreateTimeOff()

  const [technicianId, setTechnicianId] = useState<string>('')
  const [date, setDate] = useState(todayISO())
  const [partial, setPartial] = useState(false)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('18:00')
  const [reason, setReason] = useState('')

  const [initialized, setInitialized] = useState(false)
  if (open && !initialized) {
    setTechnicianId(technicians[0] ? String(technicians[0].id) : '')
    setDate(todayISO())
    setPartial(false)
    setStart('09:00')
    setEnd('18:00')
    setReason('')
    setInitialized(true)
  }
  if (!open && initialized) {
    setInitialized(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const techId = Number(technicianId)
    if (!techId) {
      toast.error('Vui lòng chọn kỹ thuật viên')
      return
    }
    if (!date) {
      toast.error('Vui lòng chọn ngày')
      return
    }

    let startMin: number | undefined
    let endMin: number | undefined
    if (partial) {
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      startMin = sh * 60 + sm
      endMin = eh * 60 + em
      if (startMin >= endMin) {
        toast.error('Giờ bắt đầu phải trước giờ kết thúc')
        return
      }
    }

    try {
      await createTimeOff.mutateAsync({
        technicianId: techId,
        date,
        startMin,
        endMin,
        reason: reason.trim() || undefined,
      })
      toast.success('Đã thêm ngày nghỉ')
      onOpenChange(false)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Có lỗi xảy ra')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm ngày nghỉ</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="off-tech">Kỹ thuật viên</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger id="off-tech" className="w-full">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="off-date">Ngày</Label>
            <Input id="off-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="off-partial">Nghỉ một phần ngày</Label>
            <Switch id="off-partial" checked={partial} onCheckedChange={setPartial} />
          </div>

          {partial && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="off-start">Từ</Label>
                <Input id="off-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="off-end">Đến</Label>
                <Input id="off-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="off-reason">Lý do (tuỳ chọn)</Label>
            <Input
              id="off-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nghỉ phép, ốm, ..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={createTimeOff.isPending}>
              {createTimeOff.isPending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Shared states
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      Đang tải…
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {message}
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
