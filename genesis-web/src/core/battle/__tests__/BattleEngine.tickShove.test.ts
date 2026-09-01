// A unit's tick lives in two places and they have to agree.
//
//   registeredTicks     the engine schedules from this
//   unit.tickPosition   the timeline draws from this
//
// Effects write through `battle.setUnit`, which only reaches the snapshot's
// Unit objects, so a `tickShove` landing on anyone but the actor used to move
// the marker and nothing else. Tara's Chaotic Vortex — the one skill in the
// shipped roster that shoves other units, and the skill CLAUDE.md § Game Design
// Principles 6 names as her identity — drew every enemy sliding four ticks
// forward and then acted them all exactly on time.
//
// Note the shape of the assertions. "The two representations agree" passes
// vacuously when the shove does nothing at all, which is how the first attempt
// at this test reported success against the broken engine. Every case here
// asserts the shove LANDED before asserting the two agree.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig, rollFor,
} from './_testHelpers'

/** The cast must connect — an evaded cast shoves nobody, which passes vacuously. */
const ROLL_HIT = rollFor('Hit')

const SHOVE = 4

/** Chaotic Vortex's shape: all-enemies, with the shove as the only effect. */
function vortex() {
  return makeSkillInstance(makeDamageSkillDef({
    id: 'chaotic_vortex',
    targeting: { selector: 'all-enemies', range: 'global' } as never,
    effects: [
      { id: 'shove', when: { event: 'onCast' }, type: 'tickShove', amount: SHOVE },
    ] as never,
  }))
}

describe('tickShove keeps both tick representations in step', () => {
  beforeEach(() => { __resetRegistry(); registerBuiltins(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('shoves every enemy in the engine, not just on the timeline', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(ROLL_HIT)
    const skill = vortex()
    const hero  = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foeA  = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false, hp: 500 })
    const foeB  = makeUnit({ id: 'e2', tickPosition: 120, isAlly: false, hp: 500 })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foeA, foeB],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 100], ['e2', 120]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, foeA)
    await vi.runAllTimersAsync()

    const s = latest()
    const byId = new Map(s.enemies.map(e => [e.id, e]))

    // The shove landed. Without this the agreement check below is vacuous.
    expect(byId.get('e1')!.tickPosition).toBe(100 + SHOVE)
    expect(byId.get('e2')!.tickPosition).toBe(120 + SHOVE)

    // And the engine agrees with the timeline.
    expect(s.registeredTicks.get('e1')).toBe(byId.get('e1')!.tickPosition)
    expect(s.registeredTicks.get('e2')).toBe(byId.get('e2')!.tickPosition)
  })

  it('leaves units alone when nothing shoved them', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(ROLL_HIT)
    const plain = makeSkillInstance(makeDamageSkillDef())
    const hero  = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foe   = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false, hp: 500 })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [plain]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 100]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(plain, foe)
    await vi.runAllTimersAsync()

    const s = latest()
    expect(s.enemies[0].tickPosition).toBe(100)
    expect(s.registeredTicks.get('e1')).toBe(100)
  })

  it('an evaded cast shoves nobody', async () => {
    // Guards the fix against over-reach: reconciliation must not invent a move
    // the effects never made.
    vi.spyOn(Math, 'random').mockReturnValue(rollFor('Evade'))
    const skill = vortex()
    const hero  = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foe   = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false, hp: 500 })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 100]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, foe)
    await vi.runAllTimersAsync()

    const s = latest()
    expect(s.enemies[0].tickPosition).toBe(100)
    expect(s.registeredTicks.get('e1')).toBe(100)
  })
})
