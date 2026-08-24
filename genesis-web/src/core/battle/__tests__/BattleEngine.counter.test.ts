// Counter mechanic: an Evade outcome on a single-target skill offers the
// defender's counter/uniqueCounter skill — a decision prompt for a
// player-controlled defender, an automatic AP-gated fire-or-skip for AI.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import {
  makeUnit, makeDamageSkillDef, makeSkillInstance, makeCallbacks, makeConfig,
} from './_testHelpers'

function makeCounterSkillDef() {
  return makeDamageSkillDef({
    id:   'riposte',
    name: 'Riposte',
    tags: ['physical', 'melee', 'counter'],
    apCost: 5,
  })
}

// The AI telegraph path calls Math.random() twice for delay jitter (think
// delay, then input delay) before the attack's dice roll — so the roll
// itself is the 3rd call. The counter roll after COUNTER_ANNOUNCE_MS is the
// 4th. Everything else (jitter, any later roll) gets a harmless 'Hit' value.
function mockDeterministicRandom(): void {
  let call = 0
  vi.spyOn(Math, 'random').mockImplementation(() => {
    call += 1
    if (call === 3) return 0.6   // attack dice roll → Evade
    if (call === 4) return 0.05  // counter roll → succeeds
    return 0.3                   // jitter delays / any later roll → Hit
  })
}

describe('BattleEngine — counter mechanic', () => {
  beforeEach(() => {
    __resetRegistry()
    registerBuiltins()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('offers a counter decision when a controlled defender evades a single-target attack', async () => {
    const attackSkillDef  = makeDamageSkillDef()
    const attackSkillInst = makeSkillInstance(attackSkillDef)
    const counterInst     = makeSkillInstance(makeCounterSkillDef())

    // Attacker is the AI-controlled enemy; defender is the controlled player,
    // who evades and holds a counter-tagged skill with enough AP to pay for it.
    const player = makeUnit({ id: 'p1', tickPosition: 100, ap: 50 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[enemy.id, [attackSkillInst]], [player.id, [counterInst]]]),
      registeredTicks: new Map([[player.id, 100], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    mockDeterministicRandom()

    engine.start()
    // Drive through the AI-turn timers up to the point the attack lands.
    await vi.advanceTimersByTimeAsync(6000)

    expect(latest().pendingCounterDecision).not.toBeNull()
    expect(latest().pendingCounterDecision?.defender.id).toBe(player.id)
  })

  it('confirmCounter fires the defender\'s counter skill against the original attacker', async () => {
    const attackSkillDef  = makeDamageSkillDef()
    const attackSkillInst = makeSkillInstance(attackSkillDef)
    const counterInst     = makeSkillInstance(makeCounterSkillDef())

    const player = makeUnit({ id: 'p1', tickPosition: 100, ap: 50 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false, hp: 100 })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[enemy.id, [attackSkillInst]], [player.id, [counterInst]]]),
      registeredTicks: new Map([[player.id, 100], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    mockDeterministicRandom()
    engine.start()
    // Advance just past the counter roll, but well before the original attack's
    // own ANIM_TIMEOUT_MS commit — confirmCounter mutates the same pending-turn
    // snapshot the AI turn will later commit, so it must fire before that commit
    // happens or its damage is silently orphaned (mirrors the real UI's decision window).
    await vi.advanceTimersByTimeAsync(3600)
    expect(latest().pendingCounterDecision).not.toBeNull()

    engine.confirmCounter()
    expect(latest().pendingCounterDecision).toBeNull()

    // The counter attack itself fires 200ms later and only mutates the shared
    // pending-turn snapshot — the engine's public `enemies` array isn't updated
    // until the original AI turn's own enemy_applying step commits it, so we
    // must advance past that commit point too before reading the result.
    await vi.advanceTimersByTimeAsync(3000)

    // The counter (strength 50 × 100%) should have landed on the original attacker.
    const finalEnemy = latest().enemies.find(e => e.id === enemy.id)!
    expect(finalEnemy.hp).toBeLessThan(100)
  })

  it('skipCounter clears the pending decision without firing the skill', async () => {
    const attackSkillDef  = makeDamageSkillDef()
    const attackSkillInst = makeSkillInstance(attackSkillDef)
    const counterInst     = makeSkillInstance(makeCounterSkillDef())

    const player = makeUnit({ id: 'p1', tickPosition: 100, ap: 50 })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false, hp: 100 })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[enemy.id, [attackSkillInst]], [player.id, [counterInst]]]),
      registeredTicks: new Map([[player.id, 100], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    mockDeterministicRandom()
    engine.start()
    await vi.advanceTimersByTimeAsync(6000)
    expect(latest().pendingCounterDecision).not.toBeNull()

    engine.skipCounter()

    expect(latest().pendingCounterDecision).toBeNull()
    const finalEnemy = latest().enemies.find(e => e.id === enemy.id)!
    expect(finalEnemy.hp).toBe(100)  // counter never fired
  })
})
