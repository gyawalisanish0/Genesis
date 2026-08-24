// Player-turn behaviour: routing into player_turn, executeSkill resolution,
// skipTurn, and victory detection.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig,
} from './_testHelpers'

describe('BattleEngine — player turn', () => {
  beforeEach(() => {
    __resetRegistry()
    registerBuiltins()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('routes straight to player_turn when only the controlled unit is active', () => {
    const player = makeUnit({ id: 'p1', tickPosition: 0 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      registeredTicks: new Map([[player.id, 0], [enemy.id, 100]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    engine.start()

    expect(latest().battleStep).toBe('player_turn')
  })

  it('executeSkill resolves a guaranteed Hit, damages the target, and advances the tick', async () => {
    const skillDef = makeDamageSkillDef()
    const skillInst = makeSkillInstance(skillDef)
    const player = makeUnit({ id: 'p1', tickPosition: 0 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false, hp: 100 })
    const { cb, latest, logs } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[player.id, [skillInst]]]),
      registeredTicks: new Map([[player.id, 0], [enemy.id, 100]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    engine.start()
    expect(latest().battleStep).toBe('player_turn')

    // Force the dice roll to land on 'Hit' (precision 50, baseChance 1.0 → finalChance 1.0;
    // cumulative table is Boosted .10 | Hit .50 | Evade .70 | Fail 1.0).
    vi.spyOn(Math, 'random').mockReturnValue(0.3)

    engine.executeSkill(skillInst, enemy)
    expect(cb.onPlayDice).toHaveBeenCalledWith('Hit')

    await vi.advanceTimersByTimeAsync(5000)

    const finalEnemy = latest().enemies.find(e => e.id === enemy.id)!
    expect(finalEnemy.hp).toBe(50)  // 100 − round(strength 50 × 100%)
    expect(latest().battleStep).toBe('player_turn')  // only active unit again after tick advances
    expect(logs.some(l => l.includes('Basic Strike'))).toBe(true)
  })

  it('skipTurn grants AP regen and advances the tick without resolving an attack', () => {
    const player = makeUnit({ id: 'p1', tickPosition: 0, ap: 50, maxAp: 100, apRegenRate: 2 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false })
    const { cb, latest, logs } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      registeredTicks: new Map([[player.id, 0], [enemy.id, 100]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    engine.start()
    engine.skipTurn()

    const finalPlayer = latest().playerUnits.find(u => u.id === player.id)!
    expect(finalPlayer.tickPosition).toBe(10)      // SKIP_TU_COST
    expect(finalPlayer.ap).toBe(70)                // 50 + 10 ticks × 2 regen
    expect(logs).toContain('You skipped your turn.')
    expect(cb.onBattleEnd).not.toHaveBeenCalled()
  })

  it('declares victory and calls onBattleEnd once all enemies are defeated', async () => {
    const skillDef = makeDamageSkillDef()
    const skillInst = makeSkillInstance(skillDef)
    const player = makeUnit({ id: 'p1', tickPosition: 0 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false, hp: 10 })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[player.id, [skillInst]]]),
      registeredTicks: new Map([[player.id, 0], [enemy.id, 100]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    engine.start()
    vi.spyOn(Math, 'random').mockReturnValue(0.3)  // guaranteed Hit
    engine.executeSkill(skillInst, enemy)

    await vi.advanceTimersByTimeAsync(5000)

    expect(cb.onBattleEnd).toHaveBeenCalledWith('victory', expect.any(Number), expect.any(Number))
    expect(latest().battleStep).toBe('battle_over')
  })
})
