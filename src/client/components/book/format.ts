// Small formatters local to the /book wizard (kept out of lib/api.ts).

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

/** 450000 → "450.000 ₫". */
export function fmtVND(n: number): string {
  return vnd.format(n)
}

/** 60 → "1 giờ", 90 → "1 giờ 30 phút", 45 → "45 phút". */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} phút`
  if (m === 0) return `${h} giờ`
  return `${h} giờ ${m} phút`
}

/** "HH:MM" (from an <input type="time">) → minutes-from-midnight. */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
