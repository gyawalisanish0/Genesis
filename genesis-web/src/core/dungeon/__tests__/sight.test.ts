// Fog reveal and entity visibility must agree on the shape of sight. When they
// disagreed the arena drew entities standing on unrevealed black tiles; when
// the shape was a Chebyshev square it put a straight edge across the screen
// where the light stopped.

import { describe, it, expect } from 'vitest'
import { isWithinSight, sightBand, SIGHT_BANDS, SIGHT_MEMORY } from '../sight'

const RADIUS = 3

describe('isWithinSight', () => {
  it('reaches exactly radius tiles on the cardinals', () => {
    expect(isWithinSight(RADIUS, 0, RADIUS)).toBe(true)
    expect(isWithinSight(0, -RADIUS, RADIUS)).toBe(true)
    expect(isWithinSight(RADIUS + 1, 0, RADIUS)).toBe(false)
  })

  it('rounds the corners in — that is what makes the edge read as light', () => {
    expect(isWithinSight(RADIUS, RADIUS, RADIUS)).toBe(false)
    expect(isWithinSight(2, 3, RADIUS)).toBe(false)
  })

  it('is symmetric in every direction', () => {
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = 0; dx <= RADIUS; dx++) {
        const lit = isWithinSight(dx, dy, RADIUS)
        expect(isWithinSight(-dx, dy, RADIUS)).toBe(lit)
        expect(isWithinSight(dx, -dy, RADIUS)).toBe(lit)
        expect(isWithinSight(dy, dx, RADIUS)).toBe(lit)
      }
    }
  })
})

describe('sightBand', () => {
  it('is brightest under the party', () => {
    expect(sightBand(0, 0, RADIUS)).toBe(SIGHT_BANDS)
  })

  it('falls off monotonically along a cardinal', () => {
    const bands = [0, 1, 2, 3].map((d) => sightBand(d, 0, RADIUS))
    for (let i = 1; i < bands.length; i++) expect(bands[i]).toBeLessThanOrEqual(bands[i - 1])
    expect(bands[3]).toBeGreaterThan(SIGHT_MEMORY)
  })

  it('marks everything outside sight as remembered', () => {
    expect(sightBand(RADIUS, RADIUS, RADIUS)).toBe(SIGHT_MEMORY)
    expect(sightBand(9, 0, RADIUS)).toBe(SIGHT_MEMORY)
  })

  it('never emits a band with no style behind it', () => {
    // Each band maps to one --fog-* token in DungeonArena.module.css.
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const band = sightBand(dx, dy, RADIUS)
        expect(band).toBeGreaterThanOrEqual(SIGHT_MEMORY)
        expect(band).toBeLessThanOrEqual(SIGHT_BANDS)
      }
    }
  })

  it('agrees with isWithinSight about what is lit', () => {
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const lit = sightBand(dx, dy, RADIUS) !== SIGHT_MEMORY
        expect(lit, `${dx},${dy}`).toBe(isWithinSight(dx, dy, RADIUS))
      }
    }
  })
})
