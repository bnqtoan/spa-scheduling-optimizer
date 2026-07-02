import { describe, expect, it } from 'vitest'
import { contains, overlaps, subtractIntervals, weekdayOf } from './slots'

describe('overlaps (half-open)', () => {
  it('detects true overlap', () => {
    expect(overlaps({ start: 0, end: 60 }, { start: 30, end: 90 })).toBe(true)
    expect(overlaps({ start: 30, end: 90 }, { start: 0, end: 60 })).toBe(true)
  })

  it('treats touching endpoints as non-overlapping (back-to-back allowed)', () => {
    expect(overlaps({ start: 0, end: 60 }, { start: 60, end: 120 })).toBe(false)
    expect(overlaps({ start: 60, end: 120 }, { start: 0, end: 60 })).toBe(false)
  })

  it('detects containment as overlap', () => {
    expect(overlaps({ start: 0, end: 120 }, { start: 30, end: 90 })).toBe(true)
    expect(overlaps({ start: 30, end: 90 }, { start: 0, end: 120 })).toBe(true)
  })

  it('returns false for fully disjoint intervals', () => {
    expect(overlaps({ start: 0, end: 60 }, { start: 120, end: 180 })).toBe(false)
  })

  it('returns true when intervals share more than a point', () => {
    expect(overlaps({ start: 100, end: 200 }, { start: 199, end: 300 })).toBe(true)
  })
})

describe('contains', () => {
  it('accepts an inner interval fitting inside (shared endpoints ok)', () => {
    expect(contains({ start: 540, end: 1020 }, { start: 540, end: 600 })).toBe(true)
    expect(contains({ start: 540, end: 1020 }, { start: 960, end: 1020 })).toBe(true)
    expect(contains({ start: 540, end: 1020 }, { start: 600, end: 700 })).toBe(true)
  })

  it('rejects an inner interval that spills over either edge', () => {
    expect(contains({ start: 540, end: 1020 }, { start: 500, end: 600 })).toBe(false)
    expect(contains({ start: 540, end: 1020 }, { start: 1000, end: 1080 })).toBe(false)
  })
})

describe('weekdayOf (UTC, 0=Sunday)', () => {
  it('maps known dates correctly', () => {
    expect(weekdayOf('2026-07-02')).toBe(4) // Thursday
    expect(weekdayOf('2026-07-05')).toBe(0) // Sunday
    expect(weekdayOf('2026-07-04')).toBe(6) // Saturday
    expect(weekdayOf('2024-01-01')).toBe(1) // Monday
  })

  it('is TZ-stable (pure date, no local drift)', () => {
    // Midnight UTC on this date; a naive local parse could roll to the prev day.
    expect(weekdayOf('2026-03-01')).toBe(0) // Sunday
  })

  it('returns NaN for malformed input', () => {
    expect(Number.isNaN(weekdayOf('not-a-date'))).toBe(true)
    expect(Number.isNaN(weekdayOf('2026-7-2'))).toBe(true)
  })
})

describe('subtractIntervals', () => {
  const base = { start: 540, end: 1020 } // 09:00–17:00

  it('returns the whole base when nothing is blocked', () => {
    expect(subtractIntervals(base, [])).toEqual([{ start: 540, end: 1020 }])
  })

  it('carves a single block out of the middle', () => {
    expect(subtractIntervals(base, [{ start: 720, end: 780 }])).toEqual([
      { start: 540, end: 720 },
      { start: 780, end: 1020 },
    ])
  })

  it('trims a block at the leading edge', () => {
    expect(subtractIntervals(base, [{ start: 540, end: 600 }])).toEqual([
      { start: 600, end: 1020 },
    ])
  })

  it('trims a block at the trailing edge', () => {
    expect(subtractIntervals(base, [{ start: 960, end: 1020 }])).toEqual([
      { start: 540, end: 960 },
    ])
  })

  it('merges overlapping and adjacent blocks', () => {
    expect(
      subtractIntervals(base, [
        { start: 600, end: 700 },
        { start: 650, end: 750 }, // overlaps previous
        { start: 750, end: 800 }, // adjacent to previous
      ]),
    ).toEqual([
      { start: 540, end: 600 },
      { start: 800, end: 1020 },
    ])
  })

  it('clamps blocks that extend beyond base', () => {
    expect(subtractIntervals(base, [{ start: 0, end: 600 }])).toEqual([
      { start: 600, end: 1020 },
    ])
    expect(subtractIntervals(base, [{ start: 1000, end: 2000 }])).toEqual([
      { start: 540, end: 1000 },
    ])
  })

  it('ignores blocks entirely outside base', () => {
    expect(subtractIntervals(base, [{ start: 0, end: 300 }])).toEqual([
      { start: 540, end: 1020 },
    ])
  })

  it('returns [] when base is fully covered', () => {
    expect(subtractIntervals(base, [{ start: 500, end: 1100 }])).toEqual([])
  })

  it('returns [] for an empty base', () => {
    expect(subtractIntervals({ start: 600, end: 600 }, [])).toEqual([])
  })

  it('does not emit zero-width slivers on touching blocks', () => {
    expect(
      subtractIntervals(base, [
        { start: 540, end: 700 },
        { start: 700, end: 1020 },
      ]),
    ).toEqual([])
  })
})
