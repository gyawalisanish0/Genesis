import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerEffect, getHandler, __resetRegistry,
} from '../../effects/registry'
import type { Effect, EffectHandler } from '../../effects/types'

describe('effect registry', () => {
  beforeEach(() => {
    __resetRegistry()
  })

  it('returns the handler that was registered', () => {
    const handler: EffectHandler<Extract<Effect, { type: 'damage' }>> = () => {}
    registerEffect('damage', handler)
    expect(getHandler('damage')).toBe(handler)
  })

  it('throws when looking up an unregistered handler', () => {
    expect(() => getHandler('heal')).toThrow(/No effect handler/)
  })

  it('throws when registering the same type twice', () => {
    registerEffect('damage', () => {})
    expect(() => registerEffect('damage', () => {})).toThrow(/already registered/)
  })
})
