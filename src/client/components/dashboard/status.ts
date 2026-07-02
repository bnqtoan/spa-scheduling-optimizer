// Shared status metadata: Vietnamese labels + soft pastel event colors.
import type { BookingStatus } from '@/lib/api'

export const STATUS_LABEL: Record<BookingStatus, string> = {
  scheduled: 'Đã đặt',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

/** Soft pastel palette per status for calendar events (bg / border / text). */
export const STATUS_COLORS: Record<
  BookingStatus,
  { bg: string; border: string; text: string }
> = {
  scheduled: { bg: '#ede9fe', border: '#7c3aed', text: '#5b21b6' }, // violet (theme)
  completed: { bg: '#dcfce7', border: '#22c55e', text: '#166534' }, // green
  cancelled: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' }, // red
}
