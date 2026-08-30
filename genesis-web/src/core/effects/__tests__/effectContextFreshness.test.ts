// An EffectContext is built once per cast and reused for every effect in the
// list. Its Unit objects are therefore snapshots of the moment the cast began,
// and a handler that writes one back reverts everything the effects before it
// did to that unit.
//
// This is not hypothetical. Before applyEffect refreshed the context, shipped
// content behaved like this:
//
//   husty_001_disruption   damage + status on one target -> 0 damage
//   plasma_beam            same shape, same result
//   cached_shockwave       the caster's own AP cost refunded by its own status
//   intell_of_goddess      the shield erased by the dodge applied after it
//
// Nothing threw. Two attack skills in the shipped roster simply did nothing.
//
// The guarantee is tested here rather than through the engine because it
// belongs to applyEffect: `core/` is a hook system, and a handler must be able
// to say what it does without also knowing the unit it was handed may be
// stale.

import { describe, it, expect, beforeEach } from 'vitest'
import { __resetRegistry } from '../registry'
import { registerBuiltins } from '../builtins'
import { applyEffect } from '../applyEffect'
import { makeSnapshot, snapshotToBattleState } from '../../battle/BattleSnapshot'
import { createUnit } from '../../unit'
import type { CharacterDef, Unit } from '../../types'
import type { EffectContext } from '../types'

function def(id: string): CharacterDef {
  return {
    type: 'character', id, name: id, className: 'warrior', rarity: 1,
    stats: { strength: 10, endurance: 10, power: 50, resistance: 10, speed: 10, precision: 10 },
    maxHp: 200, maxAp: 100, startingAp: 60, apRegenRate: 0.6,
  } as unknown as CharacterDef
}

function scene() {
  const caster = createUnit(def('caster'), true)
  const target = createUnit(def('target'), false)
  const snap   = makeSnapshot([caster], [target])
  const battle = snapshotToBattleState(snap)
  const ctx: EffectContext = {
    caster, target, battle, source: 'skill',
    event: { event: 'onCast' }, currentTick: 0,
  } as EffectContext
  return { ctx, snap, caster, target }
}

const damage = (amount: number) =>
  ({ id: 'd', when: { event: 'onCast' }, type: 'damage', amount } as never)

describe('applyEffect hands every handler a live unit', () => {
  beforeEach(() => { __resetRegistry(); registerBuiltins() })

  it('does not let a second effect revert the first on the same target', () => {
    const { ctx, snap, target } = scene()

    applyEffect(damage(25), ctx)
    const afterFirst = snap.get(target.id)!.hp
    applyEffect(damage(10), ctx)

    // Both landed. With a stale context the second write restores the unit the
    // context captured, and the first 25 damage disappears.
    expect(afterFirst).toBe(200 - 25)
    expect(snap.get(target.id)!.hp).toBe(200 - 25 - 10)
  })

  it('does not let an effect on the caster revert an earlier one', () => {
    const { ctx, snap, caster } = scene()

    // `target: 'self'` is how the shipped content addresses the caster —
    // cached_shockwave's own status is written this way.
    applyEffect({ id: 's', when: { event: 'onCast' }, target: 'self', type: 'spendAp', amount: 25 } as never, ctx)
    const afterSpend = snap.get(caster.id)!.ap
    applyEffect({ id: 'g', when: { event: 'onCast' }, target: 'self', type: 'gainAp', amount: 5 } as never, ctx)

    expect(afterSpend).toBe(60 - 25)
    expect(snap.get(caster.id)!.ap).toBe(60 - 25 + 5)
  })

  it('refreshes multi-target lists too', () => {
    const caster = createUnit(def('caster'), true)
    const a      = createUnit(def('a'), false)
    const b      = createUnit(def('b'), false)
    const snap   = makeSnapshot([caster], [a, b])
    const ctx    = {
      caster, targets: [a, b] as readonly Unit[],
      battle: snapshotToBattleState(snap), source: 'skill',
      event: { event: 'onCast' }, currentTick: 0,
    } as EffectContext

    applyEffect({ id: 't', when: { event: 'onCast' }, type: 'tickShove', amount: 4 } as never, ctx)
    applyEffect({ id: 't2', when: { event: 'onCast' }, type: 'tickShove', amount: 3 } as never, ctx)

    // Cumulative. A stale `targets` array would apply each shove to the
    // original position, leaving only the last one.
    expect(snap.get(a.id)!.tickPosition).toBe(a.tickPosition + 7)
    expect(snap.get(b.id)!.tickPosition).toBe(b.tickPosition + 7)
  })

  it('evaluates conditions against live state, not the pre-cast unit', () => {
    const { ctx, snap, target } = scene()

    applyEffect(damage(150), ctx)   // 200 -> 50, now below half
    applyEffect({
      id: 'c', when: { event: 'onCast' }, type: 'damage', amount: 10,
      condition: { targetHpBelow: 0.5 },
    } as never, ctx)

    // The gate has to see 50, not the 200 the context captured.
    expect(snap.get(target.id)!.hp).toBe(40)
  })
})
