// Timeline marker positioning utilities.
// Converts tick positions on the infinite timeline to visual positions on screen.
//
// **Timeline Direction:**
// - BOTTOM (low %) = act now (current/earliest tick)
// - TOP (high %) = soonest future action
// - Fixed range: 0–300 ticks

const TIMELINE_TOP_MARGIN = 2.5  // rem — matches CSS .timelineAxis top
const TIMELINE_BOTTOM_MARGIN = 2.5  // rem — matches CSS .timelineAxis bottom
const TIMELINE_CONTAINER_HEIGHT = 100  // vh
const USABLE_HEIGHT = TIMELINE_CONTAINER_HEIGHT - (TIMELINE_TOP_MARGIN + TIMELINE_BOTTOM_MARGIN)
const MAX_TICK_RANGE = 300  // Fixed tick range: 0–300

/**
 * Calculates the visual percentage (top: value) for a marker based on tick position.
 *
 * **Timeline Direction:**
 * - Bottom (low %) = act now (current tick, earliest)
 * - Top (high %) = soonest future actions
 *
 * Uses fixed 0–300 tick range for consistent scaling across battles.
 *
 * @param unitTickPosition The unit's current tick position (0–300)
 * @param currentTick The battle's current tick (for reference)
 * @returns CSS percentage string (e.g., "75%" = near bottom = act soon)
 *
 * @example
 * // Player at tick 50, battle at tick 15
 * const top = calculateMarkerPosition(50, 15)
 * // Returns "78%" → player is 35 ticks ahead, appears near bottom
 *
 * // Enemy at tick 200, battle at tick 15
 * const top = calculateMarkerPosition(200, 15)
 * // Returns "61%" → enemy is 185 ticks ahead, appears higher up
 */
export function calculateMarkerPosition(
  unitTickPosition: number,
  currentTick: number
): string {
  // Calculate how far ahead this unit is from current tick
  const ticksAhead = Math.max(0, unitTickPosition - currentTick)

  // Clamp to max range (0–300)
  const clampedTicks = Math.min(ticksAhead, MAX_TICK_RANGE)

  // Normalize to 0–1 (0 = act now at bottom, 1 = furthest future at top)
  const normalized = clampedTicks / MAX_TICK_RANGE

  // Invert: top margin + (normalized * usable height)
  // Higher normalized = higher on screen (future)
  // Lower normalized = lower on screen (act now)
  const visualPercent = TIMELINE_TOP_MARGIN + normalized * USABLE_HEIGHT

  return `${visualPercent}%`
}

/**
 * Alternate API: pass only unit tick, infer current from context.
 * Use this when you already know the battle's current tick elsewhere.
 *
 * @param unitTickPosition The unit's tick position
 * @param currentTick The current battle tick (default: 0)
 * @returns CSS percentage string
 */
export function getMarkerPosition(
  unitTickPosition: number,
  currentTick: number = 0
): string {
  return calculateMarkerPosition(unitTickPosition, currentTick)
}

/**
 * Sorts units by tick position (ascending) — lowest ticks first.
 * Useful for rendering or analyzing turn order.
 *
 * @param units Array of Unit objects
 * @returns Sorted array by tickPosition (lowest first)
 *
 * @example
 * const sorted = sortUnitsByTick(units)
 * // sorted[0] acts soonest, sorted[n] acts last
 */
export function sortUnitsByTick(units: { tickPosition: number; id: string }[]): typeof units {
  return [...units].sort((a, b) => a.tickPosition - b.tickPosition)
}

/**
 * Identifies which unit acts next (soonest tick).
 *
 * @param units Array of Unit objects
 * @returns The unit with the lowest tickPosition, or null if empty
 */
export function getNextActingUnit(
  units: { tickPosition: number; id: string; name: string }[]
): typeof units[0] | null {
  if (units.length === 0) return null
  return units.reduce((earliest, unit) =>
    unit.tickPosition < earliest.tickPosition ? unit : earliest
  )
}

/**
 * Calculates visual distance between two units on the timeline.
 * Useful for animation or visual grouping.
 *
 * @param tick1 First unit's tick position
 * @param tick2 Second unit's tick position
 * @param currentTick Battle's current tick
 * @returns Visual percentage distance between them
 */
export function getMarkerDistance(
  tick1: number,
  tick2: number,
  currentTick: number = 0
): number {
  const pos1 = parseFloat(calculateMarkerPosition(tick1, currentTick))
  const pos2 = parseFloat(calculateMarkerPosition(tick2, currentTick))
  return Math.abs(pos1 - pos2)
}
