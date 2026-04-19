import { describe, it, expect } from 'vitest'
import { roll, applyOutcome, calculateTumblingDelay, resolveEvasionCounter } from '../combat/DiceResolver'
import { DICE_BASE_PROBABILITIES, TUMBLING_DELAY_MIN, TUMBLING_DELAY_MAX } from '../constants'

describe('roll', () => {
  it('always returns a valid outcome', () => {
    const valid = new Set(Object.keys(DICE_BASE_PROBABILITIES))
    for (let i = 0; i < 100; i++) {
      expect(valid.has(roll({ ...DICE_BASE_PROBABILITIES }))).toBe(true)
    }
  })

  it('returns Success when only Success has probability', () => {
    const onlySuccess = { Boosted: 0, Success: 1, Tumbling: 0, GuardUp: 0, Evasion: 0, Fail: 0 }
    for (let i = 0; i < 20; i++) expect(roll(onlySuccess)).toBe('Success')
  })
})

describe('applyOutcome', () => {
  it('Boosted multiplies output by 1.5', () => {
    const result = applyOutcome('Boosted', 100)
    expect(result.output).toBe(150)
    expect(result.evaded).toBe(false)
  })

  it('Tumbling multiplies output by 0.5 and adds delay', () => {
    const result = applyOutcome('Tumbling', 100)
    expect(result.output).toBe(50)
    expect(result.tumbleDelay).toBeGreaterThanOrEqual(TUMBLING_DELAY_MIN)
    expect(result.tumbleDelay).toBeLessThanOrEqual(TUMBLING_DELAY_MAX)
  })

  it('GuardUp returns full output plus 10% mitigation', () => {
    const result = applyOutcome('GuardUp', 200)
    expect(result.output).toBe(200)
    expect(result.guardMitigation).toBe(20)
  })

  it('Evasion sets output to 0 and evaded to true', () => {
    const result = applyOutcome('Evasion', 100)
    expect(result.output).toBe(0)
    expect(result.evaded).toBe(true)
  })

  it('Success returns raw output unchanged', () => {
    const result = applyOutcome('Success', 80)
    expect(result.output).toBe(80)
    expect(result.evaded).toBe(false)
    expect(result.tumbleDelay).toBe(0)
    expect(result.guardMitigation).toBe(0)
  })
})

describe('calculateTumblingDelay', () => {
  it('stays within [TUMBLING_DELAY_MIN, TUMBLING_DELAY_MAX]', () => {
    for (let i = 0; i < 50; i++) {
      const d = calculateTumblingDelay()
      expect(d).toBeGreaterThanOrEqual(TUMBLING_DELAY_MIN)
      expect(d).toBeLessThanOrEqual(TUMBLING_DELAY_MAX)
    }
  })
})

describe('resolveEvasionCounter', () => {
  it('returns a boolean', () => {
    expect(typeof resolveEvasionCounter(0)).toBe('boolean')
  })

  it('never crashes at high depth values', () => {
    expect(() => resolveEvasionCounter(100)).not.toThrow()
  })
})
