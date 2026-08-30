// `onEvade` fires on a dodge, and its payload used to be multiplied by
// `outcomeScale('Evade')`, which is 0. The event existed and could never do
// anything.
//
// Husty's Cached Shockwave is the case in the shipped roster.
// docs/characters/in-game/husty.md documents 250% surge on hit and 125% on
// evade, and the JSON carries exactly that halving — the author already priced
// the dodge in. Scaling it again by the dodge applied the penalty twice, so an
// evaded Shockwave dealt nothing while still spending 25 AP, a 25-tick cooldown
// and the entire Power Surge pool. The doc says in as many words that "a
// shockwave can't be fully dodged".
//
// Note how the Evade is forced. Pinning `Math.random` is NOT enough: at 0.9
// this skill rolls Fail, and a Fail with only an onEvade effect correctly does
// nothing — which looks identical to the bug. The first version of this test
// "reproduced" the bug that way and was measuring the wrong branch entirely.
// A dodge status sets `dodged`, which forces Evade whatever the roll does.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import { outcomeScale } from '../../combat/DiceResolver'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig,
} from './_testHelpers'

const EVADE_PAYLOAD = 60
const TARGET_HP     = 500

/** A target that always dodges, so the outcome is Evade by construction. */
function alwaysDodges() {
  return makeUnit({
    id: 'e1', tickPosition: 99, isAlly: false, hp: TARGET_HP,
    statusSlots: [{
      id: 'dodge', name: 'Dodge', stacks: 1, duration: 99, source: 'e1',
      nextIntervalFireTick: 0, payload: { dodgeConfig: { allChance: 1 } },
    }] as never,
  })
}

function shockwave() {
  return makeSkillInstance(makeDamageSkillDef({
    id: 'cached_shockwave',
    effects: [
      { id: 'ev', when: { event: 'onEvade' }, type: 'damage', amount: EVADE_PAYLOAD, damageType: 'energy' },
    ] as never,
  }))
}

describe('onEvade payloads survive the dodge that triggered them', () => {
  beforeEach(() => { __resetRegistry(); registerBuiltins(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('is worth testing: the Evade scale really is zero', () => {
    expect(outcomeScale('Evade')).toBe(0)
  })

  it('deals the authored evade damage rather than nothing', async () => {
    const skill = shockwave()
    const hero  = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foe   = alwaysDodges()
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 99]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, foe)
    await vi.runAllTimersAsync()

    expect(latest().enemies[0].hp).toBe(TARGET_HP - EVADE_PAYLOAD)
  })

  it('still suppresses the onHit payload on a dodge', async () => {
    // The fix must not turn an Evade into a Hit. Only the onEvade branch gets
    // the neutral magnitude; onHit effects should not run at all.
    const skill = makeSkillInstance(makeDamageSkillDef({
      id: 'mixed',
      effects: [
        { id: 'hit', when: { event: 'onHit' }, type: 'damage', amount: 999 },
      ] as never,
    }))
    const hero = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foe  = alwaysDodges()
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 99]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, foe)
    await vi.runAllTimersAsync()

    expect(latest().enemies[0].hp).toBe(TARGET_HP)
  })
})
