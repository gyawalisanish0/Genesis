// D8 tick displacement is fully implemented but was, until now, entirely
// invisible: a unit could be shoved up to 4 ticks with no on-screen cause.
// onTickDisplaced is the one engine-contract addition made for the battle
// scene, so it is worth pinning that it fires exactly when displacement
// happens and stays silent when it does not.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { BattleEngine } from '../BattleEngine'
import { makeUnit, makeCallbacks, makeConfig } from './_testHelpers'
import type { BattleEngineCallbacks } from '../EngineTypes'
import { TICK_MAX_OCCUPANCY } from '../../constants'

afterEach(() => { vi.restoreAllMocks() })

/** Engine seeded with `n` units already occupying `tick`. */
function engineWithOccupiedTick(tick: number, n: number) {
  const { cb } = makeCallbacks()
  const registeredTicks = new Map<string, number>()
  const enemies = Array.from({ length: n }, (_, i) => {
    const u = makeUnit({ id: `occ-${i}`, isAlly: false, tickPosition: tick })
    registeredTicks.set(u.id, tick)
    return u
  })
  const engine = new BattleEngine(makeConfig({ enemies, registeredTicks }), cb)
  return { engine, cb }
}

describe('onTickDisplaced', () => {
  it('does not fire when the requested tick is free', () => {
    const { engine, cb } = engineWithOccupiedTick(20, 0)
    engine.registerTickInternal('newcomer', 20)
    expect(cb.onTickDisplaced).not.toHaveBeenCalled()
  })

  it('does not fire while the tick is under the occupancy cap', () => {
    const { engine, cb } = engineWithOccupiedTick(20, TICK_MAX_OCCUPANCY - 1)
    engine.registerTickInternal('newcomer', 20)
    expect(cb.onTickDisplaced).not.toHaveBeenCalled()
  })

  it('fires with from/to when the cap is exceeded', () => {
    const { engine, cb } = engineWithOccupiedTick(20, TICK_MAX_OCCUPANCY)
    engine.registerTickInternal('newcomer', 20)

    expect(cb.onTickDisplaced).toHaveBeenCalledTimes(1)
    const [id, from, to] = (cb.onTickDisplaced as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(id).toBe('newcomer')
    expect(from).toBe(20)
    expect(to).not.toBe(20)
  })

  it('reports the tick the unit actually landed on', () => {
    const { engine, cb } = engineWithOccupiedTick(20, TICK_MAX_OCCUPANCY)
    engine.registerTickInternal('newcomer', 20)
    const [, , to] = (cb.onTickDisplaced as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(engine.registeredTicks.get('newcomer')).toBe(to)
  })

  it('is optional — an engine whose callbacks omit it still registers ticks', () => {
    const { cb } = makeCallbacks()
    const bare = { ...cb } as Record<string, unknown>
    delete bare.onTickDisplaced
    const registeredTicks = new Map<string, number>()
    const enemies = Array.from({ length: TICK_MAX_OCCUPANCY }, (_, i) => {
      const u = makeUnit({ id: `occ-${i}`, isAlly: false, tickPosition: 20 })
      registeredTicks.set(u.id, 20)
      return u
    })
    const engine = new BattleEngine(
      makeConfig({ enemies, registeredTicks }),
      bare as unknown as BattleEngineCallbacks,
    )
    expect(() => engine.registerTickInternal('newcomer', 20)).not.toThrow()
    expect(engine.registeredTicks.get('newcomer')).toBeDefined()
  })
})
