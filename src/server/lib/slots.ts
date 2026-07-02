// ---------------------------------------------------------------------------
// Pure time-interval helpers (no db, no I/O). Shared by the bookings route
// (Task 05) and the slot-suggestion engine (Task 06).
//
// Conventions:
// - Times are minutes-from-midnight (0..1440).
// - Intervals are half-open: [start, end). Touching endpoints do NOT overlap.
// - Weekday is 0=Sunday .. 6=Saturday.
// ---------------------------------------------------------------------------

export type Interval = { start: number; end: number }

/**
 * Half-open overlap test for [a.start, a.end) vs [b.start, b.end).
 * Two intervals overlap iff each starts strictly before the other ends.
 * Adjacent intervals that only touch (a.end === b.start) do NOT overlap,
 * so back-to-back bookings are allowed.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * True iff `inner` fits entirely inside `outer` (half-open, inclusive of shared
 * endpoints). Used to check a booking fits inside working hours.
 */
export function contains(outer: Interval, inner: Interval): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

/**
 * Weekday for a yyyy-mm-dd date string. 0=Sunday .. 6=Saturday.
 *
 * Computed in UTC (parses the date at UTC midnight) so the result never drifts
 * with the runner's local timezone — a Cloudflare Worker has no stable local
 * TZ, and the date string carries no zone. Assumes a well-formed yyyy-mm-dd
 * input; returns NaN for anything Date cannot parse.
 */
export function weekdayOf(dateISO: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO)
  if (!m) return NaN
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/**
 * Free intervals within `base` after removing every interval in `blocks`.
 *
 * Returns a sorted, non-overlapping list of the gaps left inside `base`.
 * Blocks are clamped to `base`; blocks fully outside `base` are ignored;
 * overlapping/adjacent blocks are merged. If nothing is blocked, returns a
 * single interval equal to `base` (when base is non-empty). If `base` is empty
 * or fully covered, returns [].
 *
 * Half-open throughout: a block ending exactly where a free gap would start
 * leaves no zero-width sliver.
 */
export function subtractIntervals(base: Interval, blocks: Interval[]): Interval[] {
  if (base.end <= base.start) return []

  // Clamp blocks to base and drop empty/out-of-range ones.
  const clamped = blocks
    .map((b) => ({ start: Math.max(b.start, base.start), end: Math.min(b.end, base.end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start)

  const free: Interval[] = []
  let cursor = base.start

  for (const b of clamped) {
    if (b.start > cursor) {
      free.push({ start: cursor, end: b.start })
    }
    cursor = Math.max(cursor, b.end)
  }

  if (cursor < base.end) {
    free.push({ start: cursor, end: base.end })
  }

  return free
}
