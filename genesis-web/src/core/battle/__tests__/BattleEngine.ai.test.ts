// AI-turn behaviour: enemy_telegraph → enemy_applying resolution, the
// "gathering strength" skip path, and defeat detection from an AI attack.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import {
  AI_THINKING_MAX_MS, AI_INPUT_MAX_MS, DICE_RESULT_DISMISS_MS, ANIM_TIMEOUT_MS,
} from '../../constants'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig,
} from './_testHelpers'

const FULL_AI_TURN_MS = AI_THINKING_MAX_MS + AI_INPUT_MAX_MS + DICE_RESULT_DISMISS_MS + ANIM_TIMEOUT_MS + 1000

describe('BattleEngine — AI turn', () => {
  beforeEach(() => {
    __resetRegistry()
    registerBuiltins()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves an enemy attack against the player and advances the tick', async () => {
    const skillDef  = makeDamageSkillDef()
    const skillInst = makeSkillInstance(skillDef)
    const player = makeUnit({ id: 'p1', tickPosition: 100, hp: 100 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false })
    const { cb, latest, logs } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[enemy.id, [skillInst]]]),
      registeredTicks: new Map([[player.id, 100], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    vi.spyOn(Math, 'random').mockReturnValue(0.3)  // guaranteed Hit
    engine.start()

    expect(latest().battleStep).toBe('enemy_acting')

    await vi.advanceTimersByTimeAsync(FULL_AI_TURN_MS)

    const finalPlayer = latest().playerUnits.find(u => u.id === player.id)!
    expect(finalPlayer.hp).toBe(50)  // 100 − round(strength 50 × 100%)
    expect(logs.some(l => l.includes('Basic Strike'))).toBe(true)
  })

  it('declares defeat once the AI attack drops the last player unit to 0 HP', async () => {
    const skillDef  = makeDamageSkillDef()
    const skillInst = makeSkillInstance(skillDef)
    const player = makeUnit({ id: 'p1', tickPosition: 100, hp: 20 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[enemy.id, [skillInst]]]),
      registeredTicks: new Map([[player.id, 100], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    vi.spyOn(Math, 'random').mockReturnValue(0.3)  // guaranteed Hit; strength-100% deals 50 > 20 hp
    engine.start()

    await vi.advanceTimersByTimeAsync(FULL_AI_TURN_MS)

    expect(cb.onBattleEnd).toHaveBeenCalledWith('defeat', expect.any(Number), expect.any(Number))
    expect(latest().battleStep).toBe('battle_over')
  })

  it('skips the AI turn ("gathering strength") when no skill is available', async () => {
    const player = makeUnit({ id: 'p1', tickPosition: 100 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false, ap: 0 })
    const { cb, logs } = makeCallbacks()

    // No skills registered for the enemy at all → computeAITurn returns 'skip'.
    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[enemy.id, []]]),
      registeredTicks: new Map([[player.id, 100], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    engine.start()
    // Advance just past one BETWEEN_TURN_PAUSE_MS telegraph delay — with no
    // skill ever available, the enemy loops "gathering strength" indefinitely
    // rather than settling in a final tick position, so only the first cycle
    // is asserted here.
    await vi.advanceTimersByTimeAsync(200)

    expect(logs.some(l => l.includes('gathering strength'))).toBe(true)
  })
})
