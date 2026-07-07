import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useBookingAudit } from '@/lib/audit-api'

const ACTION_LABEL: Record<string, string> = {
  create: 'Tạo booking',
  update: 'Cập nhật',
  cancel: 'Hủy booking',
  complete: 'Hoàn thành',
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('vi-VN')
}

function fmtValues(v: unknown): string {
  if (v === null || v === undefined) return '—'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function AuditDialog({
  bookingId,
  bookingCode,
  open,
  onOpenChange,
}: {
  bookingId: number | null
  bookingCode?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const auditQuery = useBookingAudit(open ? bookingId : null)
  const entries = auditQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhật ký thay đổi{bookingCode ? ` — ${bookingCode}` : ''}</DialogTitle>
          <DialogDescription>Lịch sử thao tác trên booking này, mới nhất trước.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {auditQuery.isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">Đang tải…</p>
          )}
          {auditQuery.isError && (
            <p className="py-6 text-center text-sm text-destructive">
              Không tải được nhật ký.
            </p>
          )}
          {!auditQuery.isLoading && entries.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có thay đổi nào</p>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              className="rounded-lg bg-muted/40 p-3 text-sm ring-1 ring-foreground/5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
                <span className="text-xs text-muted-foreground">{fmtDateTime(e.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                bởi {e.username ?? 'hệ thống'}
              </p>
              {(e.oldValues != null || e.newValues != null) && (
                <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  {e.oldValues != null && <p className="truncate">cũ: {fmtValues(e.oldValues)}</p>}
                  {e.newValues != null && (
                    <p className="truncate">mới: {fmtValues(e.newValues)}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
