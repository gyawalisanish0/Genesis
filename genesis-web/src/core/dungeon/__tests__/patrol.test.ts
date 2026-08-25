// Patrol routes are waypoint lists. The original implementation indexed the
// route directly and moved the enemy to the next waypoint each turn, so
// stage_001's grunt_alpha — route (5,17) → (9,17) — teleported four tiles per
// player step and was almost never on a tile the player could see.

import { describe, it, expect } from 'vitest'
import { stepToward, advancePatrol, type TilePos } from '../patrol'

const ALPHA_ROUTE: TilePos[] = [{ x: 5, y: 17 }, { x: 9, y: 17 }]
const BETA_ROUTE: TilePos[] = [
  { x: 5, y: 13 }, { x: 5, y: 11 }, { x: 1, y: 11 }, { x: 1, y: 13 },
]

/** Walk `turns` turns and collect every tile occupied along the way. */
function walk(start: TilePos, route: TilePos[], turns: number): TilePos[] {
  let pos = start
  let idx = 0
  const path: TilePos[] = []
  for (let i = 0; i < turns; i++) {
    const step = advancePatrol(pos, route, idx)
    pos = step.next
    idx = step.targetIndex
    path.push(pos)
  }
  return path
}

const chebyshev = (a: TilePos, b: TilePos) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

describe('stepToward', () => {
  it('moves exactly one tile', () => {
    expect(stepToward({ x: 5, y: 17 }, { x: 9, y: 17 })).toEqual({ x: 6, y: 17 })
  })

  it('stays put when already there', () => {
    expect(stepToward({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
  })

  it('never moves diagonally — patrols must stay in axis-aligned corridors', () => {
    const step = stepToward({ x: 1, y: 1 }, { x: 5, y: 5 })
    expect((step.x === 1) !== (step.y === 1)).toBe(true)
  })

  it('closes the dominant axis first', () => {
    expect(stepToward({ x: 0, y: 0 }, { x: 1, y: 5 })).toEqual({ x: 0, y: 1 })
    expect(stepToward({ x: 0, y: 0 }, { x: 5, y: 1 })).toEqual({ x: 1, y: 0 })
  })
})

describe('advancePatrol', () => {
  it('never skips a tile — the bug that hid enemies from the player', () => {
    for (const route of [ALPHA_ROUTE, BETA_ROUTE]) {
      const path = walk(route[0], route, 24)
      let prev = route[0]
      for (const tile of path) {
        expect(chebyshev(prev, tile), `${JSON.stringify(prev)}→${JSON.stringify(tile)}`).toBe(1)
        prev = tile
      }
    }
  })

  it('walks grunt_alpha tile by tile between its two waypoints', () => {
    expect(walk({ x: 5, y: 17 }, ALPHA_ROUTE, 5)).toEqual([
      { x: 6, y: 17 }, { x: 7, y: 17 }, { x: 8, y: 17 }, { x: 9, y: 17 }, { x: 8, y: 17 },
    ])
  })

  it('visits every waypoint on a multi-leg route', () => {
    const visited = walk(BETA_ROUTE[0], BETA_ROUTE, 12).map((p) => `${p.x},${p.y}`)
    for (const wp of BETA_ROUTE.slice(1)) expect(visited).toContain(`${wp.x},${wp.y}`)
  })

  it('loops back to the first waypoint', () => {
    const path = walk(ALPHA_ROUTE[0], ALPHA_ROUTE, 8)
    expect(path[7]).toEqual({ x: 5, y: 17 })
  })

  it('resumes correctly from a tile between waypoints', () => {
    // A patrol interrupted mid-leg used to fall back to waypoint 0 and reverse.
    const step = advancePatrol({ x: 7, y: 17 }, ALPHA_ROUTE, 1)
    expect(step).toEqual({ next: { x: 8, y: 17 }, targetIndex: 1 })
  })

  it('holds position on an empty route', () => {
    expect(advancePatrol({ x: 2, y: 2 }, [], 0)).toEqual({ next: { x: 2, y: 2 }, targetIndex: 0 })
  })

  it('holds position on a single-waypoint route it already occupies', () => {
    const step = advancePatrol({ x: 2, y: 2 }, [{ x: 2, y: 2 }], 0)
    expect(step.next).toEqual({ x: 2, y: 2 })
  })
})
