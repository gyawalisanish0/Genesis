import { describe, it, expect } from 'vitest'
import { roll, applyOutcome, resolveCounterRoll } from '../combat/DiceResolver'
import { DICE_BASE_PROBABILITIES, FAIL_CHIP_MULTIPLIER } from '../constants'

describe('roll', () => {
  it('always returns a valid outcome', () => {
    const valid = new Set(Object.keys(DICE_BASE_PROBABILITIES))
    for (let i = 0; i < 100; i++) {
      expect(valid.has(roll({ ...DICE_BASE_PROBABILITIES }))).toBe(true)
    }
  })

  it('returns Hit when only Hit has probability', () => {
    const onlyHit = { Boosted: 0, Hit: 1, Evade: 0, Fail: 0 }
    for (let i = 0; i < 20; i++) expect(roll(onlyHit)).toBe('Hit')
  })
})

describe('applyOutcome', () => {
  it('Boosted multiplies output by 1.5', () => {
    const result = applyOutcome('Boosted', 100)
    expect(result.output).toBe(150)
    expect(result.evaded).toBe(false)
  })

  it('Hit returns raw output unchanged', () => {
    const result = applyOutcome('Hit', 80)
    expect(result.output).toBe(80)
    expect(result.evaded).toBe(false)
  })

  it('Evade sets output to 0 and evaded to true', () => {
    const result = applyOutcome('Evade', 100)
    expect(result.output).toBe(0)
    expect(result.evaded).toBe(true)
  })

  it('Fail grazes for a fraction of output rather than whiffing', () => {
    // A Fail used to produce literally nothing. Because the roll happens after
    // the AP and TU are committed, that punished the most expensive skills
    // hardest — the inverse of the risk a 50 AP skill should carry.
    const result = applyOutcome('Fail', 100)
    expect(result.output).toBe(Math.round(100 * FAIL_CHIP_MULTIPLIER))
    expect(result.output).toBeGreaterThan(0)
    expect(result.evaded).toBe(false)
  })

  it('orders the four outcomes strictly by magnitude', () => {
    // The table had four names but two behaviours: BOOSTED_MULTIPLIER lived
    // only in applyOutcome, which the battle pipeline never called, so a
    // Boosted hit dealt exactly as much as a plain Hit.
    const out = (o: Parameters<typeof applyOutcome>[0]) => applyOutcome(o, 100).output
    expect(out('Boosted')).toBeGreaterThan(out('Hit'))
    expect(out('Hit')).toBeGreaterThan(out('Fail'))
    expect(out('Fail')).toBeGreaterThan(out('Evade'))
    expect(out('Evade')).toBe(0)
  })
})

describe('resolveCounterRoll', () => {
  it('returns a boolean', () => {
    expect(typeof resolveCounterRoll(0)).toBe('boolean')
  })

  it('never crashes at high depth values', () => {
    expect(() => resolveCounterRoll(100)).not.toThrow()
  })
})
