// The defender is a participant, not a constant.
//
// Under the single-roll system the attacker rolled and the table said the
// *defender* dodged — the target contributed nothing to its own survival. The
// forecast tests prove PhaseResolver reads Endurance; this proves the engine
// does, on the live path, with a real skill against a real unit. Those are
// different claims: the resolver could compute a defender-aware table and then
// roll a defender-blind one, and every pure test would still pass.
//
// The measurement is statistical because the mechanic is. Each case rolls the
// same attack many times with real randomness and compares evade rates, which
// is why the assertions are ordering claims rather than exact numbers.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import { TWO_PHASE_BEATS_MS } from '../../constants'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig,
} from './_testHelpers'

const ROUNDS = 400

/** Fraction of `ROUNDS` casts that the target got out of the way of. */
async function evadeRate(endurance: number, precision = 50): Promise<number> {
  let evades = 0

  for (let i = 0; i < ROUNDS; i++) {
    const skill = makeSkillInstance(makeDamageSkillDef())
    const hero  = makeUnit({ id: 'p1', tickPosition: 0, ap: 100, stats: { precision } as never })
    const foe   = makeUnit({
      id: 'e1', tickPosition: 100, isAlly: false, hp: 100_000,
      stats: { endurance } as never,
    })
    const { cb } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 100]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, foe)
    // The arena badge is deliberately held back until the phase beats finish
    // playing — see BattleEngine.playDiceInSync — so it isn't fired yet
    // immediately after executeSkill returns.
    vi.advanceTimersByTime(TWO_PHASE_BEATS_MS)
    if (vi.mocked(cb.onPlayDice).mock.calls.some(c => c[0] === 'Evade')) evades += 1
    engine.destroy()
  }

  return evades / ROUNDS
}

describe('the engine rolls both phases', () => {
  beforeEach(() => { __resetRegistry(); registerBuiltins(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('lets a tougher target answer more of what is thrown at it', async () => {
    const frail  = await evadeRate(10)
    const sturdy = await evadeRate(90)

    // Roughly 0.07 against 0.38 at these stats. The margin is wide enough that
    // a defender-blind engine — which would return the same rate twice — cannot
    // pass by luck at 400 rounds.
    expect(sturdy).toBeGreaterThan(frail + 0.15)
  })

  it('still lets the actor own Precision matter', async () => {
    // Both phases, not one dressed as two: hold the defender fixed and move the
    // attacker instead.
    const clumsy = await evadeRate(50, 15)
    const sharp  = await evadeRate(50, 95)

    expect(clumsy).toBeGreaterThan(sharp + 0.05)
  })

  it('never resolves to an outcome outside the four', async () => {
    const skill = makeSkillInstance(makeDamageSkillDef())
    const hero  = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foe   = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false, hp: 100_000 })
    const { cb } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 100]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, foe)
    vi.advanceTimersByTime(TWO_PHASE_BEATS_MS)

    // Not vacuous: onPlayDice has actually fired by now (see the delay
    // asserted in BattleEngine.dicePhaseBeat.test.ts), so this loop runs.
    expect(vi.mocked(cb.onPlayDice).mock.calls.length).toBeGreaterThan(0)
    const valid = new Set(['Boosted', 'Hit', 'Evade', 'Graze'])
    for (const [outcome] of vi.mocked(cb.onPlayDice).mock.calls) {
      expect(valid.has(outcome as string), String(outcome)).toBe(true)
    }
  })
})
