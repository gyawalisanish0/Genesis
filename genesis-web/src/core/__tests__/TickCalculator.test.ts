import { describe, it, expect } from 'vitest'
import { calculateStartingTick, advanceTick, calculateApGained } from '../combat/TickCalculator'
import { CLASS_TICK_RANGES } from '../constants'

describe('calculateStartingTick', () => {
  it('returns a value within the class range at speed 0', () => {
    const [min, max] = CLASS_TICK_RANGES['Warrior']!
    for (let i = 0; i < 50; i++) {
      const tick = calculateStartingTick(0, 'Warrior')
      expect(tick).toBeGreaterThanOrEqual(min)
      expect(tick).toBeLessThanOrEqual(max)
    }
  })

  it('returns min at speed 100 (no spread)', () => {
    const [min] = CLASS_TICK_RANGES['Hunter']!
    // At speed=100, spread = round((max-min) * 0) = 0, so tick === min
    for (let i = 0; i < 20; i++) {
      expect(calculateStartingTick(100, 'Hunter')).toBe(min)
    }
  })

  it('falls back to [6, 14] for unknown class names', () => {
    for (let i = 0; i < 30; i++) {
      const tick = calculateStartingTick(50, 'Unknown')
      expect(tick).toBeGreaterThanOrEqual(6)
      expect(tick).toBeLessThanOrEqual(14)
    }
  })

  it('covers every defined class', () => {
    for (const [cls, [min, max]] of Object.entries(CLASS_TICK_RANGES)) {
      const tick = calculateStartingTick(50, cls)
      expect(tick).toBeGreaterThanOrEqual(min)
      expect(tick).toBeLessThanOrEqual(max)
    }
  })
})

describe('advanceTick', () => {
  it('adds tuCost to current tick', () => {
    expect(advanceTick(5, 8)).toBe(13)
    expect(advanceTick(0, 3)).toBe(3)
  })
})

describe('calculateApGained', () => {
  it('multiplies elapsed ticks by regen rate', () => {
    expect(calculateApGained(10, 8.0)).toBe(80)
    expect(calculateApGained(0, 12.0)).toBe(0)
  })
})
