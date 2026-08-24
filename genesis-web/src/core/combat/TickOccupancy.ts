// TickOccupancy — how crowded each position on the tick stream is.
//
// TickDisplacer enforces TICK_MAX_OCCUPANCY when a tick is committed, but the
// player never sees it coming: a full tick silently shoves the arriving unit by
// a D8 roll. These helpers let the UI show the crowd *before* the commit, so a
// displacement is a risk taken knowingly rather than a punishment out of
// nowhere. Pure — no UI, no engine state.

import { TICK_MAX_OCCUPANCY } from '../constants'

export type OccupancyState = 'free' | 'shared' | 'full'

/** Units registered at each occupied tick. Ticks with nobody on them are absent. */
export function countByTick(registeredTicks: ReadonlyMap<string, number>): Map<number, number> {
  const counts = new Map<number, number>()
  for (const tick of registeredTicks.values()) {
    counts.set(tick, (counts.get(tick) ?? 0) + 1)
  }
  return counts
}

/** How a tick should read: empty, occupied, or at the displacement threshold. */
export function occupancyState(count: number): OccupancyState {
  if (count >= TICK_MAX_OCCUPANCY) return 'full'
  if (count > 0) return 'shared'
  return 'free'
}

/**
 * Whether arriving at `tick` would trigger D8 displacement.
 *
 * Mirrors TickDisplacer's own condition: the cap is breached by the arrival, so
 * a tick already holding TICK_MAX_OCCUPANCY units displaces the next one in.
 * `movingUnitId` is excluded because a unit re-registering on its own tick does
 * not collide with itself.
 */
export function wouldDisplace(
  tick:            number,
  registeredTicks: ReadonlyMap<string, number>,
  movingUnitId?:   string,
): boolean {
  let occupants = 0
  for (const [id, at] of registeredTicks) {
    if (at === tick && id !== movingUnitId) occupants += 1
  }
  return occupants >= TICK_MAX_OCCUPANCY
}
