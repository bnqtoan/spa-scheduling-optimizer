import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Flower2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin, useMe } from '@/lib/auth-api'

/** AUTH_UNAUTHORIZED (bad creds) message; anything else falls back generic. */
function loginErrorMessage(code?: string): string {
  if (code === 'AUTH_UNAUTHORIZED') return 'Sai tên đăng nhập hoặc mật khẩu'
  return 'Đăng nhập không thành công. Vui lòng thử lại.'
}

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()
  const meQuery = useMe()
  const navigate = useNavigate()

  // Landing route per role: technicians only have /my-schedule; the dashboard
  // (`/`) is admin+receptionist. Sending a technician to `/` would bounce off
  // its RequireAuth guard and stall on the loading screen.
  const landingFor = (role: string) => (role === 'technician' ? '/my-schedule' : '/')

  // Already logged in — bounce to the right home instead of showing the form.
  if (meQuery.data) {
    void navigate({ to: landingFor(meQuery.data.role) })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    login.mutate(
      { username: username.trim(), password },
      {
        onSuccess: (res) => {
          void navigate({ to: landingFor(res.user.role) })
        },
      },
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-accent/30 via-background to-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Flower2 className="size-6" />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-foreground">
              Serenity Spa
            </p>
            <p className="text-xs text-muted-foreground">Đăng nhập quản lý lịch</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {login.isError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loginErrorMessage(login.error?.code)}
            </p>
          )}

          <Button type="submit" className="h-9 w-full" disabled={login.isPending}>
            {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  )
}
