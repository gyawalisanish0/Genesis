import { TU_ACCURACY_BASELINE } from '../constants'
import { describe, it, expect } from 'vitest'
import { calculateStrikeChance, tickFactor } from '../combat/HitChanceEvaluator'
import { strikeTable } from '../combat/PhaseResolver'

describe('calculateStrikeChance', () => {
  it('precision=50 is the balanced baseline (strikeChance=1.0)', () => {
    expect(calculateStrikeChance(50, 1.0)).toBeCloseTo(1.0)
    expect(calculateStrikeChance(100, 1.0)).toBeCloseTo(2.0)
    expect(calculateStrikeChance(25, 1.0)).toBeCloseTo(0.5)
  })

  it('scales by baseChance', () => {
    expect(calculateStrikeChance(50, 0.8)).toBeCloseTo(0.8)
    expect(calculateStrikeChance(80, 0.9)).toBeCloseTo(1.44)
  })

  it('can exceed 1.0 for high precision', () => {
    expect(calculateStrikeChance(75, 1.0)).toBeCloseTo(1.5)
  })
})

// ── Tick investment buys accuracy ────────────────────────────────────────────

describe('tickFactor', () => {
  it('is neutral at the baseline tick cost', () => {
    expect(tickFactor(TU_ACCURACY_BASELINE)).toBe(1)
  })

  it('rewards a heavier commitment and penalises a jab', () => {
    expect(tickFactor(TU_ACCURACY_BASELINE + 5)).toBeGreaterThan(1)
    expect(tickFactor(TU_ACCURACY_BASELINE - 5)).toBeLessThan(1)
  })

  it('rises monotonically with tick cost', () => {
    const seq = [1, 5, 10, 15, 20, 25].map(tickFactor)
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1])
  })

  it('never goes negative even at an absurd tick cost', () => {
    expect(tickFactor(0)).toBeGreaterThanOrEqual(0)
    expect(tickFactor(-100)).toBe(0)
  })

  it('stays neutral on a missing or malformed tick cost', () => {
    // A skill without tuCost used to yield NaN, which propagated into every
    // probability and rendered as an empty odds band instead of failing loudly.
    for (const bad of [undefined, null, NaN, Infinity] as unknown as number[]) {
      expect(tickFactor(bad), String(bad)).toBe(1)
    }
  })

  it('makes a slow skill strike cleaner than a fast one for the same unit', () => {
    const jab   = strikeTable(calculateStrikeChance(50, 1) * tickFactor(5))
    const heavy = strikeTable(calculateStrikeChance(50, 1) * tickFactor(20))
    expect(heavy.Clean + heavy.Solid).toBeGreaterThan(jab.Clean + jab.Solid)
  })
})
