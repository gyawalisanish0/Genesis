// secondaryResource — modifies caster.secondaryResource.
// Supports flat delta, random [min, max] range, an optional cap, and
// an absolute `set` override. Always targets the caster (self mechanic).

import { registerEffect }              from '../registry'
import type { Effect, EffectHandler } from '../types'
import { addSecondaryResource }       from '../../unit'

type SecondaryResourceEffect = Extract<Effect, { type: 'secondaryResource' }>

const handle: EffectHandler<SecondaryResourceEffect> = (effect, ctx) => {
  const current = ctx.caster
  const snap    = ctx.battle

  if (effect.set !== undefined) {
    snap.setUnit({ ...current, secondaryResource: effect.set })
    return
  }

  const amount = resolveDelta(effect.delta)
  const max    = effect.max ?? Infinity
  snap.setUnit(addSecondaryResource(snap.getUnit(current.id) ?? current, amount, max))
}

function resolveDelta(delta: number | [number, number] | undefined): number {
  if (delta === undefined)           return 0
  if (typeof delta === 'number')     return delta
  const [min, max] = delta
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function register(): void {
  registerEffect('secondaryResource', handle)
}
