// The engine arms its own timers, and nothing outside catches what they throw.
//
// `BattleContext.safeEngineCall` wraps the synchronous calls React makes *into*
// the engine; the React error boundaries catch renders. A throw raised inside a
// `setTimeout` the engine armed passes both and reaches `window.onerror`.
//
// The consequence was the worst available. The callback dies before arming the
// next timer, and the step machine is left on `enemy_acting` — a member of
// YIELDED_STEPS, so `drive()` refuses to advance it. No timer remains and no
// player action re-enters, because `executeSkill` and `skipTurn` both require
// `player_turn`. The battle was frozen for good, with no error shown; the only
// way out was the pause menu's LEAVE BATTLE.
//
// The trigger used here is not contrived. Five effect types pass Zod validation
// and are listed in docs/engine/00_content_contract.md, but no handler is
// registered for any of them — so a content author following the contract can
// freeze a battle by editing one JSON file.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig,
} from './_testHelpers'

/** An effect type the schema accepts and no handler implements. */
const UNHANDLED_EFFECT = {
  id: 'c', when: { event: 'onCast' }, type: 'removeStatus', status: 'guard',
}

function battleWhereTheEnemyActsFirst() {
  const bad = makeSkillInstance(makeDamageSkillDef({
    id: 'cleanse_strike', effects: [UNHANDLED_EFFECT] as never,
  }))
  const hero = makeUnit({ id: 'p1', tickPosition: 50, ap: 100 })
  const foe  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false, ap: 100, hp: 200 })
  const harness = makeCallbacks()

  const engine = new BattleEngine(makeConfig({
    playerUnits: [hero], enemies: [foe],
    unitSkillsMap:   new Map([['e1', [bad]], ['p1', [makeSkillInstance(makeDamageSkillDef())]]]),
    registeredTicks: new Map([['p1', 50], ['e1', 0]]),
    controlledIds:   new Set(['p1']),
  }), harness.cb)

  return { engine, ...harness }
}

describe('a throw inside an engine-armed timer', () => {
  beforeEach(() => { __resetRegistry(); registerBuiltins(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('does not escape the engine', async () => {
    const { engine } = battleWhereTheEnemyActsFirst()
    engine.start()

    let escaped: unknown = null
    try { await vi.runAllTimersAsync() } catch (e) { escaped = e }

    expect(escaped).toBeNull()
  })

  it('reports the original error rather than dying silently', async () => {
    const { engine, cb } = battleWhereTheEnemyActsFirst()
    engine.start()
    await vi.runAllTimersAsync()

    expect(cb.onEngineError).toHaveBeenCalledTimes(1)
    const err = vi.mocked(cb.onEngineError).mock.calls[0][0] as Error
    expect(err.message).toContain('removeStatus')
  })

  it('ends the battle instead of parking it on a step nothing can leave', async () => {
    const { engine, latest } = battleWhereTheEnemyActsFirst()
    engine.start()
    await vi.runAllTimersAsync()

    // The failure mode was `enemy_acting` with zero timers: a yielded step that
    // drive() will not advance and no callback will re-enter.
    expect(latest().battleStep).toBe('battle_over')
    expect(vi.getTimerCount()).toBe(0)

    // And it stays ended — nothing revives it.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(latest().battleStep).toBe('battle_over')
  })

  it('publishes the terminal step, so the snapshot and the engine agree', async () => {
    const { engine, latest } = battleWhereTheEnemyActsFirst()
    engine.start()
    await vi.runAllTimersAsync()

    // setStep only mutates the engine; observers read the snapshot. Leaving
    // those disagreeing is the shape of two other bugs this audit found.
    expect(latest().battleStep).toBe(engine.step)
  })

  it('leaves no timer running once it has failed', async () => {
    const { engine } = battleWhereTheEnemyActsFirst()
    engine.start()
    await vi.runAllTimersAsync()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels timers whose handle nobody kept', async () => {
    // Six of the engine's own timers were never stored in a field, so destroy()
    // could not reach them. It did not stop the engine, it orphaned it: a
    // surviving callback called drive(), the loop resumed against a screen that
    // no longer existed, and it could reach endBattle -> onBattleEnd, which
    // writes the result to the global store and navigates. Quitting a battle
    // could land the player on a victory screen for the fight they left.
    const { engine } = battleWhereTheEnemyActsFirst()
    let ran = false
    engine.safeTimeout(() => { ran = true }, 1500)

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    engine.destroy()

    // Immediately, before advancing. Checking after advancing is vacuous: an
    // uncancelled timer FIRES during the advance and the count reaches 0 either
    // way, which is how the first version of this test passed against the bug.
    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(ran).toBe(false)
  })

  it('will not resume the loop after being destroyed', async () => {
    const { engine, cb } = battleWhereTheEnemyActsFirst()
    engine.start()
    engine.destroy()

    // A callback already dequeued when destroy() ran can still call drive().
    // Put the engine on a step drive() would actually advance, or the yielded
    // -step guard short-circuits and the test proves nothing.
    engine.step = 'advance_tick'
    engine.drive()

    // Nothing rearmed, and the loop did not resume.
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(cb.onBattleEnd).not.toHaveBeenCalled()
  })
})
