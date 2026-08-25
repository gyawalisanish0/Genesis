// The skill detail panel is the only place a player can read what a skill
// actually does, so a line that overstates an effect is a correctness bug, not
// a cosmetic one.
//
// It previously rendered `when.event` and nothing else. An effect carrying a
// `condition` therefore read as unconditional: Hugo's basic attack advertised
// "Shove tick: +2" with no hint that it only happens on a Boosted roll.

import { describe, it, expect } from 'vitest'
import { effectLine, conditionText, valueText } from '../skillEffectText'
import type { Effect, Condition } from '../../core/effects/types'

const onCast = { event: 'onCast' } as const

describe('conditionText', () => {
  it('names every branch of the condition union', () => {
    const cases: Array<[Condition, RegExp]> = [
      [{ chance: 0.25 },                    /25% chance/],
      [{ diceOutcome: 'Boosted' },          /on Boosted/],
      [{ selfHpBelow: 0.3 },                /self HP < 30%/],
      [{ selfHpAbove: 0.8 },                /self HP > 80%/],
      [{ targetHpBelow: 0.5 },              /target HP < 50%/],
      [{ targetHpAbove: 0.5 },              /target HP > 50%/],
      [{ selfApBelow: 20 },                 /self AP < 20/],
      [{ selfApAbove: 60 },                 /self AP > 60/],
      [{ hasStatus: 'burn' },               /target has burn/],
      [{ selfHasStatus: 'guard' },          /self has guard/],
      [{ hasTag: 'mech' },                  /target tagged mech/],
      [{ apAccumGte: 40 },                  /AP pool ≥ 40/],
      [{ selfSecondaryAbove: 3 },           /surge > 3/],
      [{ selfSecondaryBelow: 2 },           /surge < 2/],
      [{ selfStatusStacksBelow: { id: 'rage', stacks: 3 } }, /rage < 3 stacks/],
      [{ not: { diceOutcome: 'Fail' } },    /not on Fail/],
      [{ all: [{ chance: 0.5 }, { hasTag: 'boss' }] }, /and/],
      [{ any: [{ chance: 0.5 }, { hasTag: 'boss' }] }, /or/],
    ]
    for (const [cond, pattern] of cases) {
      expect(conditionText(cond), JSON.stringify(cond)).toMatch(pattern)
    }
  })

  it('never silently claims certainty for an unrecognised condition', () => {
    // A future condition variant must degrade to a hedge, not to nothing.
    const exotic = { somethingNew: 1 } as unknown as Condition
    expect(conditionText(exotic)).toBe('conditional')
  })
})

describe('effectLine', () => {
  it('qualifies a conditional effect so it cannot read as guaranteed', () => {
    const shove: Effect = {
      when: onCast, condition: { diceOutcome: 'Boosted' },
      type: 'tickShove', amount: 2,
    }
    const line = effectLine(shove)
    expect(line).toContain('+2')
    expect(line).toMatch(/Boosted/)
  })

  it('leaves an unconditional effect unqualified', () => {
    const shove: Effect = { when: onCast, type: 'tickShove', amount: 1 }
    expect(effectLine(shove)).toBe('Shove tick: +1')
  })

  it('signs a negative shove, which pulls a marker earlier', () => {
    const pull: Effect = { when: onCast, type: 'tickShove', amount: -5 }
    expect(effectLine(pull)).toContain('-5')
  })

  it('prefixes a non-default trigger', () => {
    const onMiss: Effect = {
      when: { event: 'onMiss' }, type: 'damage', amount: 10,
    }
    expect(effectLine(onMiss)).toMatch(/^\[onMiss\]/)
  })

  it('renders every stat-percent value expression', () => {
    expect(valueText({ stat: 'strength', percent: 60 })).toBe('60% caster strength')
    expect(valueText({ stat: 'power', percent: 30, of: 'target' })).toBe('30% target power')
    expect(valueText(12)).toBe('12')
  })
})
