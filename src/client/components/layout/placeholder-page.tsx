import type { ReactNode } from 'react'
import { TopBar } from './top-bar'
import { Card, CardContent } from '@/components/ui/card'

export function PlaceholderPage({
  title,
  actions,
}: {
  title: string
  actions?: ReactNode
}) {
  return (
    <>
      <TopBar title={title} actions={actions} />
      <main className="flex-1 p-6">
        <Card>
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-1 text-center">
            <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
