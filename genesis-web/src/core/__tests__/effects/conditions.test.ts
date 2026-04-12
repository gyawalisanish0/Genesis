import { describe, it, expect } from 'vitest'
import { evaluateCondition } from '../../effects/conditions'
import type { EffectContext } from '../../effects/types'
import { makeBattleState, makeUnit } from './_testHelpers'

function ctx(opts: { casterHp?: number; targetHp?: number; targetStatusId?: string } = {}): EffectContext {
  const caster = makeUnit({ id: 'c', hp: opts.casterHp ?? 100 })
  const target = makeUnit({
    id: 't',
    hp: opts.targetHp ?? 100,
    isAlly: false,
    statusSlots: opts.targetStatusId
      ? [{ id: opts.targetStatusId, name: 'x', duration: 1, source: 'test' }]
      : [],
  })
  return {
    caster, target,
    battle: makeBattleState([caster, target]),
    source: 'skill',
    event:  { event: 'onCast' },
  }
}

describe('evaluateCondition', () => {
  it('selfHpBelow fires when caster is below threshold', () => {
    expect(evaluateCondition({ selfHpBelow: 0.5 }, ctx({ casterHp: 30 }))).toBe(true)
    expect(evaluateCondition({ selfHpBelow: 0.5 }, ctx({ casterHp: 80 }))).toBe(false)
  })

  it('targetHpBelow returns false when there is no target', () => {
    const c = makeUnit({ id: 'c' })
    const noTarget: EffectContext = {
      caster: c,
      battle: makeBattleState([c]),
      source: 'skill',
      event:  { event: 'onCast' },
    }
    expect(evaluateCondition({ targetHpBelow: 0.5 }, noTarget)).toBe(false)
  })

  it('hasStatus checks the target status slot ids', () => {
    expect(evaluateCondition({ hasStatus: 'burn' }, ctx({ targetStatusId: 'burn' }))).toBe(true)
    expect(evaluateCondition({ hasStatus: 'burn' }, ctx({}))).toBe(false)
  })

  it('diceOutcome matches the context dice', () => {
    const c = makeUnit({ id: 'c' })
    const base: EffectContext = {
      caster: c,
      battle: makeBattleState([c]),
      source: 'skill',
      event:  { event: 'onDiceRoll' },
      dice:   'Tumbling',
    }
    expect(evaluateCondition({ diceOutcome: 'Tumbling' }, base)).toBe(true)
    expect(evaluateCondition({ diceOutcome: 'Boosted'  }, base)).toBe(false)
  })

  it('boolean composition: not / all / any', () => {
    const c = ctx({ casterHp: 30 })
    expect(evaluateCondition({ not: { selfHpBelow: 0.5 } }, c)).toBe(false)
    expect(evaluateCondition({ all: [{ selfHpBelow: 0.5 }, { selfHpBelow: 0.4 }] }, c)).toBe(true)
    expect(evaluateCondition({ any: [{ selfHpBelow: 0.1 }, { selfHpBelow: 0.5 }] }, c)).toBe(true)
    expect(evaluateCondition({ any: [{ selfHpBelow: 0.1 }, { selfHpBelow: 0.2 }] }, c)).toBe(false)
  })
})
