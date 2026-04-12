// Timeline marker positioning utilities.
// Converts tick positions on the infinite timeline to visual positions on screen.

const TIMELINE_TOP_MARGIN = 2.5  // rem — matches CSS .timelineAxis top
const TIMELINE_BOTTOM_MARGIN = 2.5  // rem — matches CSS .timelineAxis bottom
const TIMELINE_CONTAINER_HEIGHT = 100  // vh
const USABLE_HEIGHT = TIMELINE_CONTAINER_HEIGHT - (TIMELINE_TOP_MARGIN * 2)

/**
 * Calculates the visual percentage (top: value) for a marker based on tick position.
 *
 * Distributes all units across the available vertical space. Units with lower
 * tickPositions appear higher; higher tickPositions appear lower.
 *
 * @param unitTickPosition The unit's current tick position
 * @param allTickPositions Array of all tick positions in battle (for normalization)
 * @returns CSS percentage string (e.g., "25%")
 *
 * @example
 * const positions = units.map(u => u.tickPosition)
 * const top = calculateMarkerPosition(player.tickPosition, positions)
 * // Returns "45%" → apply via style={{ top }}
 */
export function calculateMarkerPosition(
  unitTickPosition: number,
  allTickPositions: number[]
): string {
  if (allTickPositions.length === 0) return '50%'
  if (allTickPositions.length === 1) return '50%'

  // Find min/max tick positions to normalize
  const minTick = Math.min(...allTickPositions)
  const maxTick = Math.max(...allTickPositions)
  const tickRange = maxTick - minTick

  // Normalize tick position to 0–1
  const normalized = tickRange === 0 ? 0.5 : (unitTickPosition - minTick) / tickRange

  // Map to available visual space (accounting for margins)
  const visualPercent = TIMELINE_TOP_MARGIN + normalized * USABLE_HEIGHT
  return `${visualPercent}%`
}

/**
 * Calculates marker position using a fixed tick range (e.g., 0–300).
 * Useful when you want consistent visual scaling across all battles.
 *
 * @param unitTickPosition The unit's current tick position
 * @param maxTickValue The maximum expected tick value in battle (e.g., 300)
 * @returns CSS percentage string (e.g., "25%")
 *
 * @example
 * // All battles use 0–300 tick range
 * const top = calculateMarkerPositionFixed(player.tickPosition, 300)
 */
export function calculateMarkerPositionFixed(
  unitTickPosition: number,
  maxTickValue: number = 300
): string {
  if (maxTickValue <= 0) return '50%'

  // Clamp position to valid range
  const clamped = Math.max(0, Math.min(unitTickPosition, maxTickValue))
  const normalized = clamped / maxTickValue

  // Map to available visual space
  const visualPercent = TIMELINE_TOP_MARGIN + normalized * USABLE_HEIGHT
  return `${visualPercent}%`
}

/**
 * Sorts units by tick position (ascending) — lowest ticks first.
 * Use this to render markers from top to bottom correctly.
 *
 * @param units Array of Unit objects
 * @returns Sorted array by tickPosition (lowest first)
 *
 * @example
 * const sorted = sortUnitsByTick(units)
 * return sorted.map(unit => <Marker key={unit.id} unit={unit} />)
 */
export function sortUnitsByTick(units: { tickPosition: number; id: string }[]): typeof units {
  return [...units].sort((a, b) => a.tickPosition - b.tickPosition)
}
