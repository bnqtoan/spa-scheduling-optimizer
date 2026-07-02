import { Link } from '@tanstack/react-router'
import { CalendarClock, CalendarOff, Clock, Flower2, Sparkles, Timer, Users } from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const MANAGEMENT_LINKS = [
  {
    to: '/technicians',
    label: 'Kỹ thuật viên',
    description: 'Quản lý danh sách kỹ thuật viên và kỹ năng',
    Icon: Users,
  },
  {
    to: '/services',
    label: 'Dịch vụ',
    description: 'Quản lý dịch vụ, thời lượng và giá',
    Icon: Sparkles,
  },
  {
    to: '/working-hours',
    label: 'Lịch làm việc',
    description: 'Thiết lập giờ làm việc theo từng kỹ thuật viên',
    Icon: CalendarClock,
  },
  {
    to: '/time-off',
    label: 'Ngày nghỉ',
    description: 'Đăng ký ngày nghỉ / lịch bận của kỹ thuật viên',
    Icon: CalendarOff,
  },
] as const

export function SettingsPage() {
  return (
    <>
      <TopBar title="Cài đặt" />
      <main className="flex-1 space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin cửa hàng</CardTitle>
            <CardDescription>Thông tin hiển thị chung cho toàn hệ thống (chỉ đọc trong bản MVP)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Flower2 className="size-6" />
              </span>
              <div>
                <p className="font-heading text-lg font-semibold text-foreground">Serenity Spa</p>
                <p className="text-sm text-muted-foreground">Spa &amp; chăm sóc sắc đẹp</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cấu hình lịch hẹn</CardTitle>
            <CardDescription>Khung giờ làm việc mặc định và độ chia nhỏ khung giờ đặt lịch</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/5">
              <Clock className="size-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Giờ làm việc mặc định</p>
                <p className="text-sm font-medium text-foreground">09:00 – 19:00</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/5">
              <Timer className="size-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Độ chia nhỏ khung giờ</p>
                <p className="text-sm font-medium text-foreground">15 phút / slot</p>
              </div>
            </div>
            <p className="col-span-full text-xs text-muted-foreground">
              Giờ làm việc có thể khác nhau theo từng kỹ thuật viên — xem chi tiết ở mục &ldquo;Lịch làm việc&rdquo;.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quản lý dữ liệu</CardTitle>
            <CardDescription>Đi tới các màn hình quản lý liên quan</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MANAGEMENT_LINKS.map(({ to, label, description, Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
