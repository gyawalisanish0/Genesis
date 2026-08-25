import { MIN_OUTCOME_POOL, TU_ACCURACY_BASELINE } from '../constants'
import { describe, it, expect } from 'vitest'
import { calculateFinalChance, shiftProbabilities, tuAccuracyFactor } from '../combat/HitChanceEvaluator'

describe('calculateFinalChance', () => {
  it('precision=50 is the balanced baseline (finalChance=1.0)', () => {
    expect(calculateFinalChance(50, 1.0)).toBeCloseTo(1.0)
    expect(calculateFinalChance(100, 1.0)).toBeCloseTo(2.0)
    expect(calculateFinalChance(25, 1.0)).toBeCloseTo(0.5)
  })

  it('scales by baseChance', () => {
    expect(calculateFinalChance(50, 0.8)).toBeCloseTo(0.8)
    expect(calculateFinalChance(80, 0.9)).toBeCloseTo(1.44)
  })

  it('can exceed 1.0 for high precision', () => {
    expect(calculateFinalChance(75, 1.0)).toBeCloseTo(1.5)
  })
})

describe('shiftProbabilities', () => {
  const sumProbs = (p: ReturnType<typeof shiftProbabilities>) =>
    Object.values(p).reduce((a, b) => a + b, 0)

  it('probabilities always sum to 1.0', () => {
    for (const chance of [0.3, 0.7, 1.0, 1.3, 2.0]) {
      expect(sumProbs(shiftProbabilities(chance))).toBeCloseTo(1.0)
    }
  })

  it('at finalChance=1.0 matches base probabilities', () => {
    const shifted = shiftProbabilities(1.0)
    expect(shifted.Boosted).toBeCloseTo(0.10)
    expect(shifted.Hit).toBeCloseTo(0.40)
    expect(shifted.Evade).toBeCloseTo(0.20)
    expect(shifted.Fail).toBeCloseTo(0.30)
  })

  it('higher chance increases positive pool', () => {
    const low  = shiftProbabilities(0.5)
    const high = shiftProbabilities(1.5)
    expect(high.Boosted + high.Hit).toBeGreaterThan(low.Boosted + low.Hit)
  })

  it('all values are non-negative', () => {
    for (const chance of [0.1, 0.5, 1.0, 1.5, 2.0]) {
      const p = shiftProbabilities(chance)
      for (const v of Object.values(p)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── The dice must always stay a dice ─────────────────────────────────────────
//
// finalChance = precision/50 is unbounded, so before MIN_OUTCOME_POOL a
// Precision-100 unit reached a 100% positive pool: it could not miss and could
// not be evaded. The four-outcome table silently collapsed to one result at
// both ends of the stat.

describe('outcome pool floors', () => {
  it('never lets an outcome pool reach zero, however extreme the input', () => {
    for (const finalChance of [0, 0.01, 0.5, 1, 1.5, 2, 5, 100]) {
      const p = shiftProbabilities(finalChance)
      const positive = p.Boosted + p.Hit
      const negative = p.Evade + p.Fail
      expect(positive, `positive @ ${finalChance}`).toBeGreaterThanOrEqual(MIN_OUTCOME_POOL - 1e-9)
      expect(negative, `negative @ ${finalChance}`).toBeGreaterThanOrEqual(MIN_OUTCOME_POOL - 1e-9)
      expect(positive + negative).toBeCloseTo(1, 9)
    }
  })

  it('keeps a perfect-precision unit rollable', () => {
    const p = shiftProbabilities(calculateFinalChance(100, 1))
    expect(p.Evade + p.Fail).toBeGreaterThan(0)
  })

  it('keeps a zero-precision unit capable of landing a hit', () => {
    const p = shiftProbabilities(calculateFinalChance(0, 1))
    expect(p.Boosted + p.Hit).toBeGreaterThan(0)
  })
})

// ── Tick investment buys accuracy ────────────────────────────────────────────

describe('tuAccuracyFactor', () => {
  it('is neutral at the baseline tick cost', () => {
    expect(tuAccuracyFactor(TU_ACCURACY_BASELINE)).toBe(1)
  })

  it('rewards a heavier commitment and penalises a jab', () => {
    expect(tuAccuracyFactor(TU_ACCURACY_BASELINE + 5)).toBeGreaterThan(1)
    expect(tuAccuracyFactor(TU_ACCURACY_BASELINE - 5)).toBeLessThan(1)
  })

  it('rises monotonically with tick cost', () => {
    const seq = [1, 5, 10, 15, 20, 25].map(tuAccuracyFactor)
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1])
  })

  it('never goes negative even at an absurd tick cost', () => {
    expect(tuAccuracyFactor(0)).toBeGreaterThanOrEqual(0)
    expect(tuAccuracyFactor(-100)).toBe(0)
  })

  it('stays neutral on a missing or malformed tick cost', () => {
    // A skill without tuCost used to yield NaN, which propagated into every
    // probability and rendered as an empty odds band instead of failing loudly.
    for (const bad of [undefined, null, NaN, Infinity] as unknown as number[]) {
      expect(tuAccuracyFactor(bad), String(bad)).toBe(1)
    }
  })

  it('makes a slow skill land more often than a fast one for the same unit', () => {
    const jab   = shiftProbabilities(calculateFinalChance(50, 1) * tuAccuracyFactor(5))
    const heavy = shiftProbabilities(calculateFinalChance(50, 1) * tuAccuracyFactor(20))
    expect(heavy.Hit + heavy.Boosted).toBeGreaterThan(jab.Hit + jab.Boosted)
  })
})
