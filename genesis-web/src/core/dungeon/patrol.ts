/**
 * Patrol route walking.
 *
 * A patrol route is a list of *waypoints*, not a list of steps. An enemy walks
 * one tile per turn toward the waypoint it is currently heading for, and only
 * retargets the next waypoint once it arrives. Treating the route as a step
 * list instead makes enemies teleport between distant waypoints.
 */

export interface TilePos { x: number; y: number }

export interface PatrolStep {
  /** Tile the enemy should occupy after this turn. */
  next: TilePos
  /** Waypoint index the enemy is walking toward, to carry into the next turn. */
  targetIndex: number
}

/**
 * One orthogonal tile from `from` toward `to`.
 *
 * The dominant axis moves first so patrols hug axis-aligned corridors rather
 * than cutting a diagonal through the walls between them.
 */
export function stepToward(from: TilePos, to: TilePos): TilePos {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y }
  if (Math.abs(dx) >= Math.abs(dy)) return { x: from.x + Math.sign(dx), y: from.y }
  return { x: from.x, y: from.y + Math.sign(dy) }
}

/**
 * Advance one turn along `route`, starting from `pos` and heading for
 * `targetIndex`. Standing on the target waypoint retargets the following one,
 * which is what makes the route loop.
 */
export function advancePatrol(pos: TilePos, route: TilePos[], targetIndex: number): PatrolStep {
  if (route.length === 0) return { next: { x: pos.x, y: pos.y }, targetIndex: 0 }

  let idx = ((targetIndex % route.length) + route.length) % route.length
  if (route[idx].x === pos.x && route[idx].y === pos.y) idx = (idx + 1) % route.length

  return { next: stepToward(pos, route[idx]), targetIndex: idx }
}
