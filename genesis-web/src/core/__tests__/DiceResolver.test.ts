import { describe, it, expect } from 'vitest'
import { roll, applyOutcome, resolveCounterRoll } from '../combat/DiceResolver'
import { DICE_BASE_PROBABILITIES } from '../constants'

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

  it('Fail sets output to 0 and evaded to false', () => {
    const result = applyOutcome('Fail', 100)
    expect(result.output).toBe(0)
    expect(result.evaded).toBe(false)
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
