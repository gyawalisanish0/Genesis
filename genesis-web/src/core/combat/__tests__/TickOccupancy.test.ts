// These helpers drive a warning shown to the player before they commit to a
// skill. If they disagree with TickDisplacer the UI lies about what the engine
// is going to do, so the agreement is asserted directly rather than assumed.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { countByTick, occupancyState, wouldDisplace } from '../TickOccupancy'
import { resolveTickDisplacement } from '../TickDisplacer'
import { TICK_MAX_OCCUPANCY } from '../../constants'

afterEach(() => { vi.restoreAllMocks() })

/** `n` units parked on `tick`, plus optional extras elsewhere. */
const occupied = (tick: number, n: number, extra: Array<[string, number]> = []) =>
  new Map<string, number>([
    ...Array.from({ length: n }, (_, i) => [`u${i}`, tick] as [string, number]),
    ...extra,
  ])

describe('countByTick', () => {
  it('counts units per tick and omits empty ticks', () => {
    const counts = countByTick(new Map([['a', 10], ['b', 10], ['c', 14]]))
    expect(counts.get(10)).toBe(2)
    expect(counts.get(14)).toBe(1)
    expect(counts.has(11)).toBe(false)
  })

  it('is empty for an empty stream', () => {
    expect(countByTick(new Map()).size).toBe(0)
  })
})

describe('occupancyState', () => {
  it('reads free, shared, then full at the cap', () => {
    expect(occupancyState(0)).toBe('free')
    expect(occupancyState(1)).toBe('shared')
    expect(occupancyState(TICK_MAX_OCCUPANCY - 1)).toBe('shared')
    expect(occupancyState(TICK_MAX_OCCUPANCY)).toBe('full')
    expect(occupancyState(TICK_MAX_OCCUPANCY + 1)).toBe('full')
  })
})

describe('wouldDisplace', () => {
  it('is false while the tick is under the cap', () => {
    expect(wouldDisplace(20, occupied(20, TICK_MAX_OCCUPANCY - 1))).toBe(false)
  })

  it('is true once the tick holds the cap', () => {
    expect(wouldDisplace(20, occupied(20, TICK_MAX_OCCUPANCY))).toBe(true)
  })

  it('does not count the moving unit against its own destination', () => {
    // A unit re-registering where it already stands is not colliding with itself.
    const ticks = occupied(20, TICK_MAX_OCCUPANCY)
    expect(wouldDisplace(20, ticks, 'u0')).toBe(false)
  })

  it('ignores units standing on other ticks', () => {
    const ticks = occupied(30, TICK_MAX_OCCUPANCY, [['far', 20]])
    expect(wouldDisplace(20, ticks)).toBe(false)
  })
})

describe('agreement with TickDisplacer', () => {
  it('when wouldDisplace is false, the engine leaves the tick alone', () => {
    for (let n = 0; n < TICK_MAX_OCCUPANCY; n++) {
      const ticks = occupied(20, n)
      expect(wouldDisplace(20, ticks, 'mover')).toBe(false)
      expect(resolveTickDisplacement(20, ticks, 'mover', 0)).toBe(20)
    }
  })

  it('when wouldDisplace is true, the engine moves the unit', () => {
    const ticks = occupied(20, TICK_MAX_OCCUPANCY)
    expect(wouldDisplace(20, ticks, 'mover')).toBe(true)
    // Pin the D8 to +1 so the assertion is about displacement, not the roll.
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    expect(resolveTickDisplacement(20, ticks, 'mover', 0)).not.toBe(20)
  })

  it('agrees with the engine across a sweep of occupancies', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    for (let n = 0; n <= TICK_MAX_OCCUPANCY + 2; n++) {
      const ticks = occupied(20, n)
      const predicted = wouldDisplace(20, ticks, 'mover')
      const actual    = resolveTickDisplacement(20, ticks, 'mover', 0) !== 20
      expect(predicted).toBe(actual)
    }
  })
})
