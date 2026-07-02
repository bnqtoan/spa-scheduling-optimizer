import type { ReactNode } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TopBar({
  title,
  actions,
}: {
  title: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <h1 className="font-heading text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="ghost" size="icon" aria-label="Thông báo">
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  )
}
