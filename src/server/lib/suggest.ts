// ---------------------------------------------------------------------------
// Slot-suggestion ranking engine (Task 06 — THE CORE FEATURE).
//
// PURE and DB-free: `suggestSlots()` takes already-loaded data (the service,
// and per-technician { freeIntervals, bookingCount }) and returns the best
// scored (tech, start) slots. All DB access lives in the route handler, which
// prepares this input and calls this function. This keeps the ranking fully
// unit-testable without a database.
//
// Reuses lib/slots.ts (do NOT reimplement): Interval, contains.
// Times are minutes-from-midnight; intervals are half-open [start, end).
// ---------------------------------------------------------------------------

import { contains, type Interval } from './slots'

/** Candidate-start grid granularity, in minutes. Starts are anchored to the
 *  wall clock (:00/:15/:30/:45), NOT to the free interval or window edges. */
export const GRID_MIN = 15

/** The shortest service a spa books. A leftover free fragment smaller than this
 *  is considered "dead" (unbookable) for the gap-minimization rule (Rule 3).
 *  Kept as a module constant so the route and tests agree on one value. */
export const MIN_BOOKABLE_MIN = 30

// ---------------------------------------------------------------------------
// Input / output shapes
// ---------------------------------------------------------------------------

/** Per-technician availability, pre-computed by the route from the DB:
 *  - freeIntervals: sorted, non-overlapping free gaps for the date, already the
 *    result of subtractIntervals(workingHours, timeOff+bookings).
 *  - bookingCount: number of non-cancelled bookings the tech has that day
 *    (drives load balancing). */
export type TechAvailability = {
  technicianId: number
  technicianName: string
  freeIntervals: Interval[]
  bookingCount: number
}

export type SuggestInput = {
  /** Service duration in minutes — the slot length to place. */
  durationMin: number
  /** Desired window from the customer, half-open [from, to) in minutes. */
  from: number
  to: number
  /** Candidate technicians (already skill-filtered + active by the caller). */
  technicians: TechAvailability[]
  /** Max slots to return. Default 5. */
  limit?: number
}

export type ScoreBreakdown = {
  proximity: number
  load: number
  gap: number
}

export type ScoredSlot = {
  technicianId: number
  technicianName: string
  startMin: number
  endMin: number
  score: number
  breakdown: ScoreBreakdown
  /** carried for tiebreak; not part of the API response */
  bookingCount: number
}

// Rule weights — sum to 1.0.
export const WEIGHT_PROXIMITY = 0.4
export const WEIGHT_LOAD = 0.3
export const WEIGHT_GAP = 0.3

// ---------------------------------------------------------------------------
// SCORING — each rule returns a value in [0, 1]; higher = better.
//
// score = 0.4*proximity + 0.3*load + 0.3*gap
// ---------------------------------------------------------------------------

/**
 * RULE 1 — PROXIMITY (weight 0.40).
 *
 * Intent: prefer slots that start close to what the customer asked for. The
 * "preferred point" is the window START (`from`) — the earliest time the
 * customer wanted. A slot at or before `from` inside the window is ideal.
 *
 * Formula:
 *   distance = max(0, start - from)          // minutes past the preferred start
 *   proximity = max(0, 1 - distance / SPAN)  // linear decay, floored at 0
 * where
 *   SPAN = max(to - from, GRID_MIN)          // normalize by the window width
 *                                            // (never divide by < one grid step)
 *
 * So start === from → 1.0; a start one full window-span later → 0.0; linear in
 * between. Because candidate starts are constrained to [from, to - duration],
 * `start >= from` always holds, so distance is never negative.
 */
export function scoreProximity(start: number, from: number, to: number): number {
  const span = Math.max(to - from, GRID_MIN)
  const distance = Math.max(0, start - from)
  return Math.max(0, 1 - distance / span)
}

/**
 * RULE 2 — TECHNICIAN LOAD BALANCE (weight 0.30).
 *
 * Intent: spread work — a technician with FEWER bookings that day scores higher.
 *
 * Formula (self-normalizing, no cross-set max needed):
 *   load = 1 / (1 + bookingCount)
 *
 * 0 bookings → 1.0; 1 → 0.5; 2 → 0.333; 3 → 0.25 … Monotonically decreasing, so
 * the least-loaded tech always wins this component, all else equal. Chosen over
 * `1 - bookings/maxBookings` because it needs no knowledge of the busiest tech
 * (stable when the candidate set changes) and never hits exactly 0.
 */
export function scoreLoad(bookingCount: number): number {
  return 1 / (1 + bookingCount)
}

/**
 * RULE 3 — MINIMIZE LEFTOVER ODD GAPS (weight 0.30).
 *
 * Intent: placing [start, end) inside its free interval should leave as little
 * UNUSABLE fragment as possible. A leftover piece shorter than MIN_BOOKABLE_MIN
 * can never hold another booking, so it is wasted. Reward starts that align to a
 * free-interval edge (leaving one clean remainder) and penalize starts that
 * strand small dead fragments on either side.
 *
 * Given the free interval [f.start, f.end) that contains the slot [start, end):
 *   leftBefore = start - f.start        // fragment before the slot
 *   leftAfter  = f.end   - end          // fragment after the slot
 *   deadWaste  = (leftBefore is >0 and < MIN_BOOKABLE_MIN ? leftBefore : 0)
 *              + (leftAfter  is >0 and < MIN_BOOKABLE_MIN ? leftAfter  : 0)
 *   gap = max(0, 1 - deadWaste / MIN_BOOKABLE_MIN)
 *
 * A fragment that is 0 (perfect edge alignment) or >= MIN_BOOKABLE_MIN (still
 * bookable) contributes NO waste. Only genuinely-dead small fragments hurt.
 * Worst case deadWaste approaches 2*(MIN_BOOKABLE_MIN-1); we clamp to [0,1], so
 * two dead fragments floor the score at 0. Best case (edge-aligned) → 1.0.
 */
export function scoreGap(start: number, end: number, free: Interval): number {
  const leftBefore = start - free.start
  const leftAfter = free.end - end
  let deadWaste = 0
  if (leftBefore > 0 && leftBefore < MIN_BOOKABLE_MIN) deadWaste += leftBefore
  if (leftAfter > 0 && leftAfter < MIN_BOOKABLE_MIN) deadWaste += leftAfter
  return Math.max(0, 1 - deadWaste / MIN_BOOKABLE_MIN)
}

// ---------------------------------------------------------------------------
// Grid + duration-fit
// ---------------------------------------------------------------------------

/** First wall-clock grid tick (:00/:15/:30/:45) at or after `t`. */
function ceilToGrid(t: number): number {
  return Math.ceil(t / GRID_MIN) * GRID_MIN
}

/**
 * The free interval (if any) that fully contains [start, start+duration).
 * freeIntervals are non-overlapping, so at most one qualifies.
 */
function fittingInterval(
  start: number,
  durationMin: number,
  freeIntervals: Interval[],
): Interval | null {
  const slot: Interval = { start, end: start + durationMin }
  for (const f of freeIntervals) {
    if (contains(f, slot)) return f
  }
  return null
}

// ---------------------------------------------------------------------------
// Main entry — pure ranking
// ---------------------------------------------------------------------------

/**
 * Produce the top-`limit` scored slots across all candidate technicians.
 *
 * Pipeline (per tech): free intervals (given) → candidate starts on the 15-min
 * grid within [from, to] → keep only starts whose [start, start+duration) fits a
 * free interval (duration fit via `contains`) → score each with the 3 rules →
 * combine → sort → top-N.
 *
 * Sort: score desc; tiebreak earlier start, then less-loaded tech, then techId
 * (fully deterministic).
 */
export function suggestSlots(input: SuggestInput): ScoredSlot[] {
  const { durationMin, from, to, technicians } = input
  const limit = input.limit ?? 5

  const slots: ScoredSlot[] = []

  for (const tech of technicians) {
    // Candidate starts: 15-min grid ticks in [from, to], such that the whole
    // slot fits within the window AND inside a free interval.
    // Latest start that still ends by `to` is `to - durationMin`.
    const firstStart = ceilToGrid(from)
    const lastStart = to - durationMin

    for (let start = firstStart; start <= lastStart; start += GRID_MIN) {
      const end = start + durationMin
      const free = fittingInterval(start, durationMin, tech.freeIntervals)
      if (!free) continue // duration doesn't fit any free interval here

      const proximity = scoreProximity(start, from, to)
      const load = scoreLoad(tech.bookingCount)
      const gap = scoreGap(start, end, free)
      const score =
        WEIGHT_PROXIMITY * proximity + WEIGHT_LOAD * load + WEIGHT_GAP * gap

      slots.push({
        technicianId: tech.technicianId,
        technicianName: tech.technicianName,
        startMin: start,
        endMin: end,
        score,
        breakdown: { proximity, load, gap },
        bookingCount: tech.bookingCount,
      })
    }
  }

  slots.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score // higher score first
    if (a.startMin !== b.startMin) return a.startMin - b.startMin // earlier first
    if (a.bookingCount !== b.bookingCount) return a.bookingCount - b.bookingCount // less loaded
    return a.technicianId - b.technicianId // deterministic final tiebreak
  })

  return slots.slice(0, limit)
}
