import { useState, type FormEvent } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/layout/top-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  useCreateSkill,
  useCreateTechnician,
  useDeleteSkill,
  useDeleteTechnician,
  useSkills,
  useUpdateTechnician,
  type ApiError,
  type Technician,
} from '@/lib/api'

export function TechniciansPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Technician | null>(null)
  const [deleting, setDeleting] = useState<Technician | null>(null)
  const [skillsOpen, setSkillsOpen] = useState(false)

  const techniciansQuery = useAllTechnicians()
  const deleteTechnician = useDeleteTechnician()

  const technicians = technicians_or_empty(techniciansQuery.data)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(t: Technician) {
    setEditing(t)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteTechnician.mutateAsync(deleting.id)
      toast.success(`Đã xoá "${deleting.name}"`)
      setDeleting(null)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Xoá thất bại')
    }
  }

  return (
    <>
      <TopBar
        title="Kỹ thuật viên"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSkillsOpen(true)}>
              Quản lý kỹ năng
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Thêm kỹ thuật viên
            </Button>
          </div>
        }
      />

      <main className="flex-1 space-y-4 p-6">
        <Card>
          <CardContent>
            {techniciansQuery.error ? (
              <ErrorState message={techniciansQuery.error.message} />
            ) : techniciansQuery.isLoading ? (
              <LoadingState />
            ) : technicians.length === 0 ? (
              <EmptyState message="Chưa có kỹ thuật viên nào." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Kỹ năng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.skills.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            t.skills.map((s) => (
                              <Badge key={s.id} variant="secondary">
                                {s.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.active ? 'default' : 'outline'}>
                          {t.active ? 'Đang làm' : 'Ngừng'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(t)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <TechnicianDialog open={dialogOpen} onOpenChange={setDialogOpen} technician={editing} />
      <SkillsDialog open={skillsOpen} onOpenChange={setSkillsOpen} />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá kỹ thuật viên?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc muốn xoá <strong>{deleting?.name}</strong>? Hành động này không thể hoàn
            tác.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteTechnician.isPending}
            >
              {deleteTechnician.isPending ? 'Đang xoá…' : 'Xoá'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function technicians_or_empty(data: Technician[] | undefined) {
  return data ?? []
}

// ---------------------------------------------------------------------------
// Create/edit dialog
// ---------------------------------------------------------------------------

function TechnicianDialog({
  open,
  onOpenChange,
  technician,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  technician: Technician | null
}) {
  const isEdit = !!technician
  const skillsQuery = useSkills()
  const createTechnician = useCreateTechnician()
  const updateTechnician = useUpdateTechnician()

  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [skillIds, setSkillIds] = useState<number[]>([])

  // Reset form each time the dialog opens for a given technician (or new).
  const [initializedFor, setInitializedFor] = useState<number | null | 'new'>(null)
  const targetKey = technician ? technician.id : 'new'
  if (open && initializedFor !== targetKey) {
    setName(technician?.name ?? '')
    setActive(technician?.active ?? true)
    setSkillIds(technician?.skills.map((s) => s.id) ?? [])
    setInitializedFor(targetKey)
  }
  if (!open && initializedFor !== null) {
    setInitializedFor(null)
  }

  const pending = createTechnician.isPending || updateTechnician.isPending

  function toggleSkill(id: number) {
    setSkillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên')
      return
    }
    try {
      if (isEdit && technician) {
        await updateTechnician.mutateAsync({ id: technician.id, name, active, skillIds })
        toast.success('Đã cập nhật kỹ thuật viên')
      } else {
        await createTechnician.mutateAsync({ name, active, skillIds })
        toast.success('Đã thêm kỹ thuật viên')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Có lỗi xảy ra')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa kỹ thuật viên' : 'Thêm kỹ thuật viên'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tech-name">Tên</Label>
            <Input
              id="tech-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Thị A"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="tech-active">Đang làm việc</Label>
            <Switch id="tech-active" checked={active} onCheckedChange={setActive} />
          </div>

          <div className="space-y-1.5">
            <Label>Kỹ năng</Label>
            {skillsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Đang tải…</p>
            ) : (skillsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có kỹ năng nào.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(skillsQuery.data ?? []).map((s) => {
                  const selected = skillIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSkill(s.id)}
                      className="focus:outline-none"
                    >
                      <Badge variant={selected ? 'default' : 'outline'}>{s.name}</Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Skills management dialog
// ---------------------------------------------------------------------------

function SkillsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const skillsQuery = useSkills()
  const createSkill = useCreateSkill()
  const deleteSkill = useDeleteSkill()
  const [newSkill, setNewSkill] = useState('')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newSkill.trim()) return
    try {
      await createSkill.mutateAsync(newSkill.trim())
      setNewSkill('')
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Không thêm được kỹ năng')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSkill.mutateAsync(id)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Không xoá được kỹ năng')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quản lý kỹ năng</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Tên kỹ năng mới"
          />
          <Button type="submit" size="sm" disabled={createSkill.isPending}>
            <Plus className="size-4" />
          </Button>
        </form>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {skillsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Đang tải…</p>
          ) : (skillsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có kỹ năng nào.</p>
          ) : (
            (skillsQuery.data ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <span className="text-sm">{s.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(s.id)}
                  disabled={deleteSkill.isPending}
                >
                  <X className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
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
