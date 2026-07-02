import { useState, type FormEvent } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/layout/top-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  useAllServices,
  useCreateService,
  useDeleteService,
  useSkills,
  useUpdateService,
  type ApiError,
  type Service,
} from '@/lib/api'

const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

export function ServicesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)

  const servicesQuery = useAllServices()
  const deleteService = useDeleteService()

  const services = servicesQuery.data ?? []

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteService.mutateAsync(deleting.id)
      toast.success(`Đã ngừng cung cấp "${deleting.name}"`)
      setDeleting(null)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Xoá thất bại')
    }
  }

  return (
    <>
      <TopBar
        title="Dịch vụ"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Thêm dịch vụ
          </Button>
        }
      />

      <main className="flex-1 space-y-4 p-6">
        <Card>
          <CardContent>
            {servicesQuery.error ? (
              <ErrorState message={servicesQuery.error.message} />
            ) : servicesQuery.isLoading ? (
              <LoadingState />
            ) : services.length === 0 ? (
              <EmptyState message="Chưa có dịch vụ nào." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên dịch vụ</TableHead>
                    <TableHead>Kỹ năng</TableHead>
                    <TableHead>Thời lượng</TableHead>
                    <TableHead>Giá</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id} className={!s.active ? 'opacity-50' : undefined}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        {s.skill ? (
                          <Badge variant="secondary">{s.skill.name}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{s.durationMin} phút</TableCell>
                      <TableCell>{vndFormatter.format(s.price)}</TableCell>
                      <TableCell>
                        <Badge variant={s.active ? 'default' : 'outline'}>
                          {s.active ? 'Đang cung cấp' : 'Ngừng'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {s.active && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleting(s)}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          )}
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

      <ServiceDialog open={dialogOpen} onOpenChange={setDialogOpen} service={editing} />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ngừng cung cấp dịch vụ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleting?.name}</strong> sẽ được ẩn khỏi danh sách đặt lịch. Lịch sử booking
            liên quan vẫn được giữ nguyên.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteService.isPending}
            >
              {deleteService.isPending ? 'Đang xử lý…' : 'Ngừng cung cấp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Create/edit dialog
// ---------------------------------------------------------------------------

function ServiceDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
}) {
  const isEdit = !!service
  const skillsQuery = useSkills()
  const createService = useCreateService()
  const updateService = useUpdateService()

  const [name, setName] = useState('')
  const [skillId, setSkillId] = useState<string>('')
  const [durationMin, setDurationMin] = useState('')
  const [price, setPrice] = useState('')

  const [initializedFor, setInitializedFor] = useState<number | 'new' | null>(null)
  const targetKey = service ? service.id : 'new'
  if (open && initializedFor !== targetKey) {
    setName(service?.name ?? '')
    setSkillId(service ? String(service.skillId) : '')
    setDurationMin(service ? String(service.durationMin) : '')
    setPrice(service ? String(service.price) : '')
    setInitializedFor(targetKey)
  }
  if (!open && initializedFor !== null) {
    setInitializedFor(null)
  }

  const pending = createService.isPending || updateService.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên dịch vụ')
      return
    }
    const skillIdNum = Number(skillId)
    const durationNum = Number(durationMin)
    const priceNum = Number(price)
    if (!skillIdNum) {
      toast.error('Vui lòng chọn kỹ năng')
      return
    }
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      toast.error('Thời lượng không hợp lệ')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Giá không hợp lệ')
      return
    }

    try {
      if (isEdit && service) {
        await updateService.mutateAsync({
          id: service.id,
          name,
          skillId: skillIdNum,
          durationMin: durationNum,
          price: priceNum,
        })
        toast.success('Đã cập nhật dịch vụ')
      } else {
        await createService.mutateAsync({
          name,
          skillId: skillIdNum,
          durationMin: durationNum,
          price: priceNum,
        })
        toast.success('Đã thêm dịch vụ')
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
          <DialogTitle>{isEdit ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Tên dịch vụ</Label>
            <Input
              id="svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Massage toàn thân"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-skill">Kỹ năng yêu cầu</Label>
            <Select value={skillId} onValueChange={setSkillId}>
              <SelectTrigger id="svc-skill" className="w-full">
                <SelectValue placeholder="Chọn kỹ năng" />
              </SelectTrigger>
              <SelectContent>
                {(skillsQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="svc-duration">Thời lượng (phút)</Label>
              <Input
                id="svc-duration"
                type="number"
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="60"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-price">Giá (VND)</Label>
              <Input
                id="svc-price"
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="300000"
              />
            </div>
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
