// The reaction gets its own on-screen beat — this proves the engine hands the
// UI real data to show one, not just the combined outcome.
//
// `onShowDiceResult`'s `phases` argument is what `TwoPhaseDiceRoll` renders as
// the strike beat then the reaction beat. If the engine stopped passing it (or
// passed a strike/reaction pair that disagrees with the outcome it settles
// on), the beats would show a roll that never happened — worse than not
// showing a beat at all. `engine.diceDismissMs` is checked alongside it
// because the two are meant to move together: a roll with phases must hold
// long enough on screen to actually play them.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import { combineOutcome } from '../../combat/PhaseResolver'
import {
  DICE_RESULT_DISMISS_MS, TWO_PHASE_DICE_RESULT_DISMISS_MS, TWO_PHASE_BEATS_MS, diceDismissMs,
} from '../../constants'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig,
} from './_testHelpers'

describe('diceDismissMs', () => {
  it('is longer with phases than without', () => {
    expect(TWO_PHASE_DICE_RESULT_DISMISS_MS).toBeGreaterThan(DICE_RESULT_DISMISS_MS)
  })

  it('picks the right one from whether phases are present', () => {
    expect(diceDismissMs(true)).toBe(TWO_PHASE_DICE_RESULT_DISMISS_MS)
    expect(diceDismissMs(false)).toBe(DICE_RESULT_DISMISS_MS)
  })
})

describe('a resolved attack against an opposed target', () => {
  beforeEach(() => { __resetRegistry(); registerBuiltins(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  function opposedAttack() {
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
    return { engine, cb }
  }

  it('carries strike and reaction bands that agree with the settled outcome', () => {
    const { cb } = opposedAttack()

    const call = vi.mocked(cb.onShowDiceResult).mock.calls.find(c => c[3] !== undefined)!
    const [outcome, , , phases] = call
    expect(phases).toBeDefined()
    expect(combineOutcome(phases!.strike, phases!.reaction)).toBe(outcome)
  })

  it('sizes strikeProbabilities and reactionProbabilities as real tables summing to 1', () => {
    const { cb } = opposedAttack()
    const [, , , phases] = vi.mocked(cb.onShowDiceResult).mock.calls.find(c => c[3] !== undefined)!

    const strikeSum   = Object.values(phases!.strikeProbabilities).reduce((a, b) => a + b, 0)
    const reactionSum = Object.values(phases!.reactionProbabilities).reduce((a, b) => a + b, 0)
    expect(strikeSum).toBeCloseTo(1, 9)
    expect(reactionSum).toBeCloseTo(1, 9)
  })

  it('sets engine.diceDismissMs to the longer two-phase budget', () => {
    const { engine } = opposedAttack()
    expect(engine.diceDismissMs).toBe(TWO_PHASE_DICE_RESULT_DISMISS_MS)
  })
})

describe('the arena badge stays in step with the overlay', () => {
  // engine.cb.onPlayDice drives the arena's own outcome word, separately from
  // onShowDiceResult. Firing it at roll start used to cost nothing — the
  // single-beat overlay caught up within a second regardless — but a roll
  // that plays a strike beat and a reaction beat first would have the badge
  // answering both before either had played.

  beforeEach(() => { __resetRegistry(); registerBuiltins(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  function opposedAttack() {
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
    return { engine, cb }
  }

  it('holds the badge back until the phase beats have played', () => {
    const { cb } = opposedAttack()
    expect(cb.onPlayDice).not.toHaveBeenCalled()

    vi.advanceTimersByTime(TWO_PHASE_BEATS_MS - 10)
    expect(cb.onPlayDice).not.toHaveBeenCalled()

    vi.advanceTimersByTime(10)
    expect(cb.onPlayDice).toHaveBeenCalledTimes(1)
  })

  it('fires immediately for a roll with no phases, exactly as before', () => {
    const skill = makeSkillInstance(makeDamageSkillDef({ targeting: { selector: 'self' } as never }))
    const hero  = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foe   = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false })
    const { cb } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 100]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, hero)

    expect(cb.onPlayDice).toHaveBeenCalledTimes(1)
  })
})

describe('a self-cast skill', () => {
  beforeEach(() => { __resetRegistry(); registerBuiltins(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('rolls neither phase — there is no opposed party for a reaction beat', () => {
    const skill = makeSkillInstance(makeDamageSkillDef({
      targeting: { selector: 'self' } as never,
    }))
    const hero = makeUnit({ id: 'p1', tickPosition: 0, ap: 100 })
    const foe  = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false })
    const { cb } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits: [hero], enemies: [foe],
      unitSkillsMap:   new Map([['p1', [skill]]]),
      registeredTicks: new Map([['p1', 0], ['e1', 100]]),
      controlledIds:   new Set(['p1']),
    }), cb)

    engine.start()
    engine.executeSkill(skill, hero)

    const [, , , phases] = vi.mocked(cb.onShowDiceResult).mock.calls[0]
    expect(phases).toBeUndefined()
    expect(engine.diceDismissMs).toBe(DICE_RESULT_DISMISS_MS)
  })
})
