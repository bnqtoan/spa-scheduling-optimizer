import { describe, expect, it } from 'vitest'
import {
  GRID_MIN,
  MIN_BOOKABLE_MIN,
  scoreGap,
  scoreLoad,
  scoreProximity,
  suggestSlots,
  type TechAvailability,
} from './suggest'

// Helpers: 9:00 = 540, 17:00 = 1020.
const H = (hours: number, mins = 0) => hours * 60 + mins

function tech(overrides: Partial<TechAvailability> & { technicianId: number }): TechAvailability {
  return {
    technicianName: `Tech ${overrides.technicianId}`,
    freeIntervals: [{ start: H(9), end: H(17) }],
    bookingCount: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Skill filtering — enforced by the CALLER (route). suggestSlots only ranks the
// technicians it is given, so an unqualified tech never reaches it. We assert
// that: given only qualified techs, only they appear; an empty candidate set
// yields no slots.
// ---------------------------------------------------------------------------
describe('skill filtering (candidate set is pre-filtered by caller)', () => {
  it('returns slots only for the technicians passed in', () => {
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(12),
      technicians: [tech({ technicianId: 1 }), tech({ technicianId: 2 })],
    })
    const ids = new Set(slots.map((s) => s.technicianId))
    expect(ids).toEqual(new Set([1, 2]))
  })

  it('yields no slots when no qualified technicians are provided', () => {
    const slots = suggestSlots({ durationMin: 60, from: H(9), to: H(12), technicians: [] })
    expect(slots).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Duration fit — a gap shorter than the service is rejected.
// ---------------------------------------------------------------------------
describe('duration fit', () => {
  it('rejects starts where the service does not fit the free interval', () => {
    // Only a 45-min free gap [9:00, 9:45); a 60-min service cannot fit.
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(17),
      technicians: [tech({ technicianId: 1, freeIntervals: [{ start: H(9), end: H(9, 45) }] })],
    })
    expect(slots).toEqual([])
  })

  it('accepts a start where the service fits exactly to the interval edge', () => {
    // Exactly 60 min free [9:00, 10:00); a 60-min service fits flush.
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(17),
      technicians: [tech({ technicianId: 1, freeIntervals: [{ start: H(9), end: H(10) }] })],
    })
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ startMin: H(9), endMin: H(10) })
  })

  it('does not produce a slot that would run past the desired window end', () => {
    // Window [9:00, 10:00); a 60-min service can only start at 9:00 (ends 10:00).
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(10),
      technicians: [tech({ technicianId: 1 })],
    })
    expect(slots.map((s) => s.startMin)).toEqual([H(9)])
  })
})

// ---------------------------------------------------------------------------
// 15-minute grid — candidate starts land only on :00/:15/:30/:45.
// ---------------------------------------------------------------------------
describe('15-minute grid', () => {
  it('anchors candidate starts to the wall-clock grid, not the window', () => {
    // Window starts at 9:07 -> first grid tick at 9:15.
    const slots = suggestSlots({
      durationMin: 30,
      from: H(9, 7),
      to: H(11),
      technicians: [tech({ technicianId: 1 })],
    })
    const starts = slots.map((s) => s.startMin).sort((a, b) => a - b)
    // Every start divisible by 15, first is 9:15 (555), none before the window.
    expect(starts.every((s) => s % GRID_MIN === 0)).toBe(true)
    expect(starts[0]).toBe(H(9, 15))
  })

  it('spaces consecutive candidate starts by exactly the grid step', () => {
    const slots = suggestSlots({
      durationMin: 30,
      from: H(9),
      to: H(10),
      technicians: [tech({ technicianId: 1 })],
    })
    const starts = slots.map((s) => s.startMin).sort((a, b) => a - b)
    // [9:00, 10:00) with 30-min service, 15-min grid -> starts 9:00, 9:15, 9:30.
    expect(starts).toEqual([H(9), H(9, 15), H(9, 30)])
  })
})

// ---------------------------------------------------------------------------
// RULE 1 — proximity. A slot nearer the desired start outranks a far one,
// all else equal.
// ---------------------------------------------------------------------------
describe('Rule 1 — proximity ordering', () => {
  it('ranks an earlier (closer-to-window-start) slot above a later one, all else equal', () => {
    // One tech, wide-open free interval; only proximity differentiates starts.
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(17),
      technicians: [tech({ technicianId: 1 })],
      limit: 100,
    })
    // Sorted by score desc; the 9:00 start (proximity 1.0) must be first.
    expect(slots[0].startMin).toBe(H(9))
    // Proximity strictly decreases as start moves later.
    const s900 = slots.find((s) => s.startMin === H(9))!
    const s1000 = slots.find((s) => s.startMin === H(10))!
    expect(s900.breakdown.proximity).toBeGreaterThan(s1000.breakdown.proximity)
  })

  it('scoreProximity: 1.0 at window start, decays linearly, floors at 0', () => {
    expect(scoreProximity(H(9), H(9), H(11))).toBe(1)
    // Half a 120-min span later -> 0.5.
    expect(scoreProximity(H(10), H(9), H(11))).toBeCloseTo(0.5, 6)
    // A full span later -> 0.
    expect(scoreProximity(H(11), H(9), H(11))).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// RULE 2 — load balance. Less-loaded tech wins, all else equal.
// ---------------------------------------------------------------------------
describe('Rule 2 — load-balance ordering', () => {
  it('ranks the less-loaded technician first for the same start time', () => {
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(10), // only one grid start (9:00) fits -> proximity+gap identical
      technicians: [
        tech({ technicianId: 1, bookingCount: 3 }),
        tech({ technicianId: 2, bookingCount: 0 }),
      ],
    })
    // Both at 9:00 with identical proximity/gap; tech 2 (0 bookings) must win.
    expect(slots[0].technicianId).toBe(2)
    expect(slots[1].technicianId).toBe(1)
    expect(slots[0].breakdown.load).toBeGreaterThan(slots[1].breakdown.load)
  })

  it('scoreLoad: 1/(1+bookings), strictly decreasing', () => {
    expect(scoreLoad(0)).toBe(1)
    expect(scoreLoad(1)).toBeCloseTo(0.5, 6)
    expect(scoreLoad(3)).toBeCloseTo(0.25, 6)
    expect(scoreLoad(0)).toBeGreaterThan(scoreLoad(5))
  })
})

// ---------------------------------------------------------------------------
// RULE 3 — gap minimization. A start that leaves no odd fragment outranks one
// that strands a small unusable gap.
// ---------------------------------------------------------------------------
describe('Rule 3 — gap-minimization ordering', () => {
  it('prefers an edge-aligned start over one that strands a dead fragment, all else equal', () => {
    // Window [9:00, 10:10): for a 60-min service the only grid start that fits
    // the window is 9:00 (9:15 would end 10:15 > 10:10). So both techs are
    // compared at start 9:00 with identical proximity & load — only Rule 3
    // (their free-interval shape) differs.
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(10, 10),
      technicians: [
        // Tech 1: [9:00, 10:00) -> start 9:00 leaves 0 leftover -> gap = 1.0
        tech({ technicianId: 1, freeIntervals: [{ start: H(9), end: H(10) }] }),
        // Tech 2: [9:00, 10:10) -> start 9:00 leaves 10-min dead tail -> gap < 1
        tech({ technicianId: 2, freeIntervals: [{ start: H(9), end: H(10, 10) }] }),
      ],
    })
    const t1 = slots.find((s) => s.technicianId === 1)!
    const t2 = slots.find((s) => s.technicianId === 2)!
    expect(t1.breakdown.gap).toBe(1)
    expect(t2.breakdown.gap).toBeLessThan(1)
    expect(slots[0].technicianId).toBe(1) // clean-fit tech ranks first
  })

  it('scoreGap: 1.0 when edge-aligned; penalizes only fragments < MIN_BOOKABLE_MIN', () => {
    // Slot [540,600) in free [540,600): no leftover -> 1.0
    expect(scoreGap(540, 600, { start: 540, end: 600 })).toBe(1)
    // 10-min dead tail -> 1 - 10/30
    expect(scoreGap(540, 600, { start: 540, end: 610 })).toBeCloseTo(1 - 10 / MIN_BOOKABLE_MIN, 6)
    // A leftover >= MIN_BOOKABLE_MIN is still bookable -> no penalty
    expect(scoreGap(540, 600, { start: 540, end: 660 })).toBe(1)
    // Dead fragments on BOTH sides add up: 10 before + 10 after
    expect(scoreGap(550, 610, { start: 540, end: 620 })).toBeCloseTo(1 - 20 / MIN_BOOKABLE_MIN, 6)
  })
})

// ---------------------------------------------------------------------------
// Overall ordering — the three rules combine and sort correctly.
// ---------------------------------------------------------------------------
describe('overall ordering', () => {
  it('combines rules with 0.4/0.3/0.3 weights and sorts by total score desc', () => {
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(17),
      technicians: [
        tech({ technicianId: 1, bookingCount: 0 }),
        tech({ technicianId: 2, bookingCount: 2 }),
      ],
      limit: 100,
    })
    // Verify the composite equals the weighted sum for every returned slot.
    for (const s of slots) {
      const expected =
        0.4 * s.breakdown.proximity + 0.3 * s.breakdown.load + 0.3 * s.breakdown.gap
      expect(s.score).toBeCloseTo(expected, 9)
    }
    // Sorted descending.
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i - 1].score).toBeGreaterThanOrEqual(slots[i].score)
    }
    // Best overall slot: earliest start on the least-loaded tech.
    expect(slots[0]).toMatchObject({ technicianId: 1, startMin: H(9) })
  })

  it('respects the limit (top-N)', () => {
    const slots = suggestSlots({
      durationMin: 30,
      from: H(9),
      to: H(17),
      technicians: [tech({ technicianId: 1 })],
      limit: 3,
    })
    expect(slots).toHaveLength(3)
    // The single best slot is the window-start (proximity 1.0, clean gap).
    expect(slots[0].startMin).toBe(H(9))
    // All returned starts are on the 15-min grid and sorted by score desc.
    expect(slots.every((s) => s.startMin % GRID_MIN === 0)).toBe(true)
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i - 1].score).toBeGreaterThanOrEqual(slots[i].score)
    }
  })

  it('tiebreak: identical score -> earlier start, then less-loaded tech', () => {
    // Two techs, both 0 bookings, both wide open. Same start => same score.
    // Tiebreak must put the lower techId... actually less-loaded equal, so techId.
    const slots = suggestSlots({
      durationMin: 60,
      from: H(9),
      to: H(10),
      technicians: [tech({ technicianId: 5 }), tech({ technicianId: 2 })],
    })
    // Same 9:00 start, identical scores -> deterministic: techId 2 before 5.
    expect(slots.map((s) => s.technicianId)).toEqual([2, 5])
  })
})
