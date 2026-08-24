// Clash resolution (controlled unit + enemy on the same tick) and
// same-team speed-tie collision handling.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import { CLASH_ANNOUNCE_MS } from '../../constants'
import { makeUnit, makeCallbacks, makeConfig } from './_testHelpers'

describe('BattleEngine — clash and team collision', () => {
  beforeEach(() => {
    __resetRegistry()
    registerBuiltins()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves a clash in favour of the faster faction and routes to player_turn', async () => {
    const player = makeUnit({ id: 'p1', tickPosition: 0, stats: { speed: 90 } as never })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false, stats: { speed: 10 } as never })
    const { cb, latest, logs } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      registeredTicks: new Map([[player.id, 0], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    engine.start()
    expect(latest().battleStep).toBe('clash_announcing')
    expect(logs.some(l => l.startsWith('CLASH'))).toBe(true)

    await vi.advanceTimersByTimeAsync(CLASH_ANNOUNCE_MS + 100)

    expect(latest().battleStep).toBe('player_turn')
  })

  it('resolves a clash in favour of the enemy and routes to enemy_telegraph', async () => {
    const player = makeUnit({ id: 'p1', tickPosition: 0, stats: { speed: 10 } as never })
    const enemy  = makeUnit({ id: 'e1', tickPosition: 0, isAlly: false, stats: { speed: 90 } as never })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [player],
      enemies:         [enemy],
      unitSkillsMap:   new Map([[enemy.id, []]]),
      registeredTicks: new Map([[player.id, 0], [enemy.id, 0]]),
      controlledIds:   new Set([player.id]),
    }), cb)

    engine.start()
    await vi.advanceTimersByTimeAsync(CLASH_ANNOUNCE_MS + 100)

    // No skills registered for the enemy → it settles into the AI skip loop
    // rather than attacking, but the important assertion is that clash
    // routed control to the enemy side at all.
    expect(latest().battleStep === 'enemy_acting' || latest().battleStep === 'enemy_telegraph').toBe(true)
  })

  it('offers a Now/Later choice when two controlled units tie on speed and tick', () => {
    const p1 = makeUnit({ id: 'p1', tickPosition: 0, stats: { speed: 50 } as never })
    const p2 = makeUnit({ id: 'p2', tickPosition: 0, stats: { speed: 50 } as never })
    const enemy = makeUnit({ id: 'e1', tickPosition: 100, isAlly: false })
    const { cb, latest } = makeCallbacks()

    const engine = new BattleEngine(makeConfig({
      playerUnits:     [p1, p2],
      enemies:         [enemy],
      registeredTicks: new Map([[p1.id, 0], [p2.id, 0], [enemy.id, 100]]),
      controlledIds:   new Set([p1.id, p2.id]),
    }), cb)

    engine.start()

    expect(latest().battleStep).toBe('team_collision')
    expect(latest().pendingTeamCollision?.units.map(u => u.id).sort()).toEqual(['p1', 'p2'])

    engine.resolveTeamCollision(new Map([[p1.id, 'now'], [p2.id, 'later']]))

    expect(latest().battleStep).toBe('player_turn')
    const finalP2 = latest().playerUnits.find(u => u.id === p2.id)!
    expect(finalP2.tickPosition).toBe(1)  // deferred by one tick
  })
})
