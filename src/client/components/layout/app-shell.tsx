import { Outlet } from '@tanstack/react-router'
import { Sidebar } from './sidebar'

export function AppShell() {
  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar />
      <div className="flex min-h-svh flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
