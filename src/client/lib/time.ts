// Time helpers. Backend stores times as minutes-from-midnight; FullCalendar and
// the UI need Date objects / "HH:MM" strings. Working hours are 09:00–19:00.

export const WORK_START_MIN = 9 * 60 // 09:00
export const WORK_END_MIN = 19 * 60 // 19:00

/** "HH:MM" slot string for FullCalendar slotMin/MaxTime, e.g. minToSlot(540) → "09:00:00". */
export function minToSlot(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${pad(h)}:${pad(m)}:00`
}

/** Local Date on `dateISO` (YYYY-MM-DD) at `min` minutes from midnight. */
export function minToDate(dateISO: string, min: number): Date {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const h = Math.floor(min / 60)
  const m = min % 60
  return new Date(y, mo - 1, d, h, m, 0, 0)
}

/** Human "HH:MM" from minutes-from-midnight, e.g. fmtHM(545) → "09:05". */
export function fmtHM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

/** "09:00 – 10:30" range label from two minute values. */
export function fmtRange(startMin: number, endMin: number): string {
  return `${fmtHM(startMin)} – ${fmtHM(endMin)}`
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  return toISODate(new Date())
}

/** Date → YYYY-MM-DD (local). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Shift a YYYY-MM-DD string by `days` (can be negative). */
export function shiftISO(dateISO: string, days: number): string {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const dt = new Date(y, mo - 1, d)
  dt.setDate(dt.getDate() + days)
  return toISODate(dt)
}

/** Long Vietnamese label for a date, e.g. "Thứ Ba, 02/07/2026". */
export function fmtDateLabelVi(dateISO: string): string {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const dt = new Date(y, mo - 1, d)
  const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  return `${weekdays[dt.getDay()]}, ${pad(d)}/${pad(mo)}/${y}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
