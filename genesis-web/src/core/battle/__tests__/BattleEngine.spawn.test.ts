// spawnUnit — mid-battle unit injection (e.g. summon effects).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetRegistry } from '../../effects/registry'
import { registerBuiltins } from '../../effects/builtins'
import { BattleEngine } from '../BattleEngine'
import { makeUnit, makeCallbacks, makeConfig } from './_testHelpers'

describe('BattleEngine — spawnUnit', () => {
  beforeEach(() => {
    __resetRegistry()
    registerBuiltins()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('adds a new ally unit to playerUnits and registers its tick', () => {
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

    const summoned = makeUnit({ id: 'summon1', tickPosition: 5, isAlly: true })
    engine.spawnUnit(summoned, [], null, null)

    const snap = latest()
    expect(snap.playerUnits.map(u => u.id)).toContain('summon1')
    expect(snap.registeredTicks.get('summon1')).toBe(5)
  })

  it('adds a new enemy unit to enemies and registers its tick', () => {
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

    const summoned = makeUnit({ id: 'summon2', tickPosition: 5, isAlly: false })
    engine.spawnUnit(summoned, [], null, null)

    const snap = latest()
    expect(snap.enemies.map(e => e.id)).toContain('summon2')
    expect(snap.registeredTicks.get('summon2')).toBe(5)
  })
})
