import { describe, it, expect } from 'vitest'
import { roll, rollTable, applyOutcome, resolveCounterRoll } from '../combat/DiceResolver'
import { combinedForecast, strikeTable } from '../combat/PhaseResolver'
import { GRAZE_CHIP_MULTIPLIER } from '../constants'

/** The four-outcome table an average actor faces an average defender with. */
const BASELINE = combinedForecast(1, 1)

describe('rollTable', () => {
  it('always returns a band the table declares', () => {
    const valid = new Set(Object.keys(BASELINE))
    for (let i = 0; i < 100; i++) expect(valid.has(roll({ ...BASELINE }))).toBe(true)
  })

  it('returns Hit when only Hit has probability', () => {
    const onlyHit = { Boosted: 0, Hit: 1, Evade: 0, Graze: 0 }
    for (let i = 0; i < 20; i++) expect(roll(onlyHit)).toBe('Hit')
  })

  it('rolls a strike band from the phase-1 table too', () => {
    // One implementation serves both phases; a table of StrikeBands must roll
    // StrikeBands, not silently fall through to the four-outcome fallback.
    const table = strikeTable(1)
    const valid = new Set(['Clean', 'Solid', 'Loose'])
    for (let i = 0; i < 100; i++) expect(valid.has(rollTable(table, 'Solid'))).toBe(true)
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

  it('Graze chips for a fraction of output rather than whiffing', () => {
    // A Graze used to be called Fail and produce literally nothing. Because the
    // roll happens after the AP and TU are committed, that punished the most
    // expensive skills hardest — the inverse of the risk a 50 AP skill carries.
    const result = applyOutcome('Graze', 100)
    expect(result.output).toBe(Math.round(100 * GRAZE_CHIP_MULTIPLIER))
    expect(result.output).toBeGreaterThan(0)
    expect(result.evaded).toBe(false)
  })

  it('orders the four outcomes strictly by magnitude', () => {
    // The table had four names but two behaviours: BOOSTED_MULTIPLIER lived
    // only in applyOutcome, which the battle pipeline never called, so a
    // Boosted hit dealt exactly as much as a plain Hit.
    const out = (o: Parameters<typeof applyOutcome>[0]) => applyOutcome(o, 100).output
    expect(out('Boosted')).toBeGreaterThan(out('Hit'))
    expect(out('Hit')).toBeGreaterThan(out('Graze'))
    expect(out('Graze')).toBeGreaterThan(out('Evade'))
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
