import { describe, it, expect } from 'vitest'
import { calculateFinalChance, shiftProbabilities } from '../combat/HitChanceEvaluator'

describe('calculateFinalChance', () => {
  it('multiplies precision fraction by baseChance', () => {
    expect(calculateFinalChance(100, 1.0)).toBeCloseTo(1.0)
    expect(calculateFinalChance(50, 1.0)).toBeCloseTo(0.5)
    expect(calculateFinalChance(80, 0.9)).toBeCloseTo(0.72)
  })

  it('can exceed 1.0 for high precision', () => {
    expect(calculateFinalChance(150, 1.0)).toBeCloseTo(1.5)
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
    expect(shifted.Boosted).toBeCloseTo(0.15)
    expect(shifted.Success).toBeCloseTo(0.45)
    expect(shifted.Tumbling).toBeCloseTo(0.10)
    expect(shifted.GuardUp).toBeCloseTo(0.20)
    expect(shifted.Evasion).toBeCloseTo(0.10)
  })

  it('higher chance increases positive pool', () => {
    const low  = shiftProbabilities(0.5)
    const high = shiftProbabilities(1.5)
    expect(high.Boosted + high.Success).toBeGreaterThan(low.Boosted + low.Success)
  })

  it('all values are non-negative', () => {
    for (const chance of [0.1, 0.5, 1.0, 1.5, 2.0]) {
      const p = shiftProbabilities(chance)
      for (const v of Object.values(p)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})
