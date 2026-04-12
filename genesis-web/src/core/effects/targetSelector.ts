// ─────────────────────────────────────────────────────────────────────────────
// Target selector resolution
//
// Turns a TargetSelector (string literal or `{ tag }` object) into the
// concrete list of Units it designates, against an EffectContext.
//
// Selectors that refer to "the player-chosen enemy/ally" fall through to
// ctx.target — the Skill Engine is expected to resolve the skill's
// top-level targeting block and populate ctx.target before any effect
// runs. Effect-level overrides reshape that default.
//
// `{ tag }` selection is unsupported in v0.1.0 — it requires the
// StatusEffect shape to carry tags, which is Wave C work. Attempting to
// use it throws loudly rather than silently returning an empty list.
// ─────────────────────────────────────────────────────────────────────────────

import type { EffectContext, TargetSelector } from './types'
import type { Unit } from '../types'

export function resolveTargetSelector(
  selector: TargetSelector,
  ctx:      EffectContext,
): readonly Unit[] {
  if (typeof selector === 'object') {
    throw new Error('Tag-based target selectors require status tags (Wave C)')
  }
  return resolveNamedSelector(selector, ctx)
}

function resolveNamedSelector(selector: string, ctx: EffectContext): readonly Unit[] {
  switch (selector) {
    case 'self':              return [ctx.caster]
    case 'enemy':             return ctx.target ? [ctx.target] : []
    case 'ally':              return ctx.target ? [ctx.target] : []
    case 'caster-and-target': return [ctx.caster, ...(ctx.target ? [ctx.target] : [])]
    case 'all-enemies':       return enemiesOf(ctx)
    case 'all-allies':        return alliesOf(ctx)
    case 'lowest-hp-enemy':   return lowestHp(enemiesOf(ctx))
    case 'lowest-hp-ally':    return lowestHp(alliesOf(ctx))
    case 'random-enemy':      return randomOne(enemiesOf(ctx))
    case 'random-ally':       return randomOne(alliesOf(ctx))
  }
  throw new Error(`Unknown target selector: ${selector}`)
}

function alliesOf(ctx: EffectContext): readonly Unit[] {
  return ctx.battle.getAllUnits().filter(u => u.isAlly === ctx.caster.isAlly && isLive(u))
}

function enemiesOf(ctx: EffectContext): readonly Unit[] {
  return ctx.battle.getAllUnits().filter(u => u.isAlly !== ctx.caster.isAlly && isLive(u))
}

function isLive(unit: Unit): boolean {
  return unit.hp > 0
}

function lowestHp(pool: readonly Unit[]): readonly Unit[] {
  if (pool.length === 0) return []
  const sorted = [...pool].sort((a, b) => a.hp - b.hp)
  return [sorted[0]]
}

function randomOne(pool: readonly Unit[]): readonly Unit[] {
  if (pool.length === 0) return []
  return [pool[Math.floor(Math.random() * pool.length)]]
}
