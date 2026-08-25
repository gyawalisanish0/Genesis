/**
 * The shape of what the party can see.
 *
 * Reveal used a Chebyshev square, which put a straight horizontal edge across
 * the arena where the lit tiles stopped — a rectangle cut out of black, not a
 * light falling off. A rounded blob matches the radial sight falloff drawn over
 * it, so the boundary reads as the edge of the torchlight.
 *
 * Fog reveal and entity visibility must use the same test, or entities appear
 * standing on tiles that were never revealed.
 */

/**
 * Whether a tile `dx, dy` away from the party is in sight at `radius`.
 *
 * `radius * radius + radius` rather than `radius * radius` keeps the cardinal
 * extent at exactly `radius` tiles while rounding the diagonals in, instead of
 * clipping the cardinals short.
 */
export function isWithinSight(dx: number, dy: number, radius: number): boolean {
  return dx * dx + dy * dy <= radius * radius + radius
}

/** Brightest band; `SIGHT_MEMORY` is a revealed tile currently out of sight. */
export const SIGHT_BANDS  = 3
export const SIGHT_MEMORY = 0

/**
 * Which torchlight band a tile falls in: `SIGHT_BANDS` next to the party down
 * to 1 at the edge of sight, or `SIGHT_MEMORY` beyond it.
 *
 * Banded rather than continuous because the ramp is drawn as flat steps — a
 * smooth falloff is a gradient, which pixel art does not have.
 */
export function sightBand(dx: number, dy: number, radius: number): number {
  if (!isWithinSight(dx, dy, radius)) return SIGHT_MEMORY
  const dist = Math.max(Math.abs(dx), Math.abs(dy))
  return Math.max(1, SIGHT_BANDS - Math.floor((dist * SIGHT_BANDS) / Math.max(1, radius + 1)))
}
