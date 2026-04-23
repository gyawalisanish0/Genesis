import { TICK_MAX_OCCUPANCY } from '../constants'

/**
 * Returns a signed D8 offset following the probability table:
 *   P(±1) = 30% each, P(±2) = 12.5% each, P(±3) = 5% each, P(±4) = 2.5% each
 * Never returns 0.
 */
export function rollD8Displacement(): number {
  const r = Math.random()
  // Magnitude thresholds: [0.60→1, 0.85→2, 0.95→3, 1.00→4]
  const magnitude =
    r < 0.60 ? 1 :
    r < 0.85 ? 2 :
    r < 0.95 ? 3 : 4
  const direction = Math.random() < 0.5 ? -1 : 1
  return magnitude * direction
}

/**
 * Cascade displacement until the unit lands on a tick with fewer than
 * TICK_MAX_OCCUPANCY occupants. The incoming unit (excludeId) is never
 * counted against the tick it is trying to join.
 */
export function resolveTickDisplacement(
  targetTick: number,
  registered: ReadonlyMap<string, number>,
  excludeId:  string,
): number {
  let tick = targetTick
  // Safety cap to prevent infinite loops in edge cases (e.g. every tick is full).
  const MAX_ITERATIONS = 64
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const occupants = countOccupants(tick, registered, excludeId)
    if (occupants < TICK_MAX_OCCUPANCY) return tick
    tick += rollD8Displacement()
    // Tick positions must be non-negative.
    if (tick < 0) tick = 0
  }
  return tick
}

function countOccupants(
  tick:       number,
  registered: ReadonlyMap<string, number>,
  excludeId:  string,
): number {
  let count = 0
  for (const [id, t] of registered) {
    if (id !== excludeId && t === tick) count++
  }
  return count
}
