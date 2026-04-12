import { describe, it, expect, beforeEach } from 'vitest'
import { applyEffect } from '../../effects/applyEffect'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import type { Effect, EffectContext } from '../../effects/types'
import { makeBattleState, makeUnit } from './_testHelpers'

describe('applyEffect', () => {
  beforeEach(() => {
    __resetRegistry()
    registerBuiltins()
  })

  it('runs a damage effect against the default target', () => {
    const caster = makeUnit({ id: 'c', stats: { strength: 80 } as never })
    const target = makeUnit({ id: 't', hp: 100, isAlly: false })
    const battle = makeBattleState([caster, target])
    const ctx: EffectContext = { caster, target, battle, source: 'skill', event: { event: 'onCast' } }

    const effect: Effect = {
      id: 'dmg', when: { event: 'onCast' }, type: 'damage',
      amount: { stat: 'strength', percent: 50 },
    }
    applyEffect(effect, ctx)
    expect(battle.getUnit('t')!.hp).toBe(60)  // 100 − 40
  })

  it('skips an effect when its condition is false', () => {
    const caster = makeUnit({ id: 'c' })
    const target = makeUnit({ id: 't', hp: 90, isAlly: false })
    const battle = makeBattleState([caster, target])
    const ctx: EffectContext = { caster, target, battle, source: 'skill', event: { event: 'onCast' } }

    const effect: Effect = {
      when: { event: 'onCast' },
      condition: { targetHpBelow: 0.3 },  // target is at 0.9, condition fails
      type: 'damage',
      amount: 50,
    }
    applyEffect(effect, ctx)
    expect(battle.getUnit('t')!.hp).toBe(90)  // unchanged
  })

  it('per-effect target override redirects to self', () => {
    const caster = makeUnit({ id: 'c', hp: 50, maxHp: 100 })
    const target = makeUnit({ id: 't', hp: 100, isAlly: false })
    const battle = makeBattleState([caster, target])
    const ctx: EffectContext = { caster, target, battle, source: 'skill', event: { event: 'onCast' } }

    const effect: Effect = {
      when: { event: 'onCast' },
      target: 'self',
      type: 'heal',
      amount: 30,
    }
    applyEffect(effect, ctx)
    expect(battle.getUnit('c')!.hp).toBe(80)  // 50 + 30
    expect(battle.getUnit('t')!.hp).toBe(100) // untouched
  })

  it('all-enemies override hits every live opposing unit', () => {
    const caster = makeUnit({ id: 'c', stats: { strength: 100 } as never })
    const e1 = makeUnit({ id: 'e1', hp: 100, isAlly: false })
    const e2 = makeUnit({ id: 'e2', hp: 100, isAlly: false })
    const ally = makeUnit({ id: 'a',  hp: 100, isAlly: true })
    const battle = makeBattleState([caster, e1, e2, ally])
    const ctx: EffectContext = { caster, battle, source: 'skill', event: { event: 'onCast' } }

    const effect: Effect = {
      when: { event: 'onCast' },
      target: 'all-enemies',
      type: 'damage',
      amount: 25,
    }
    applyEffect(effect, ctx)
    expect(battle.getUnit('e1')!.hp).toBe(75)
    expect(battle.getUnit('e2')!.hp).toBe(75)
    expect(battle.getUnit('a')!.hp).toBe(100)
  })
})
