// ─────────────────────────────────────────────────────────────────────────────
// applyEffect — the effect orchestrator
//
// One entry point that runs a single effect against a context:
//   1. If the effect declares a target override, resolve it and build a
//      derived context with the new target / targets
//   2. Evaluate the condition (if any); skip silently on false
//   3. Look up the handler in the registry and invoke it
//
// Effect handlers never see target-selector strings — by the time they
// run, `ctx.target` and `ctx.targets` are already concrete Unit values.
// ─────────────────────────────────────────────────────────────────────────────

import { evaluateCondition }                    from './conditions'
import { getHandler }                           from './registry'
import { resolveTargetSelector }                from './targetSelector'
import type { Effect, EffectContext, TargetSelector } from './types'
import type { Unit } from '../types'

export function applyEffect(effect: Effect, ctx: EffectContext): void {
  const live   = refresh(ctx)
  const scoped = effect.target ? rescope(live, effect.target) : live
  if (effect.condition && !evaluateCondition(effect.condition, scoped)) return
  getHandler(effect.type)(effect, scoped)
}

/**
 * Re-read caster, target and targets from battle state.
 *
 * An EffectContext is built once per cast and then reused for every effect in
 * the list, so its Unit objects are snapshots of the moment the cast began.
 * A handler that writes one of them back — and most do, because writing
 * `ctx.target` is the obvious thing to write — silently reverts everything the
 * effects before it did to that unit.
 *
 * The damage was real:
 *   husty_001_disruption   damage then a status on the same target: 0 damage
 *   plasma_beam            same shape, same result
 *   cached_shockwave       the caster's own AP cost refunded by its own status
 *   intell_of_goddess      the shield erased by the dodge applied after it
 *   primal_awareness       five self-statuses, only the last one survives
 *
 * Fixing it in each handler would be six patches and a standing invitation for
 * the seventh to reintroduce it. `core/` is a hook system: a handler is
 * supposed to be able to declare what it does without also knowing that the
 * unit it was handed may already be out of date. So the freshness guarantee
 * belongs here, where every effect passes through exactly once.
 *
 * Conditions are evaluated after this on purpose — a gate like "target below
 * half HP" that reads the pre-cast unit is the same bug wearing a different
 * hat.
 */
function refresh(ctx: EffectContext): EffectContext {
  const caster  = ctx.battle.getUnit(ctx.caster.id) ?? ctx.caster
  const target  = ctx.target  ? ctx.battle.getUnit(ctx.target.id) ?? ctx.target : undefined
  const targets = ctx.targets?.map(u => ctx.battle.getUnit(u.id) ?? u)
  return { ...ctx, caster, target, targets }
}

// Builds a derived EffectContext whose target/targets reflect the
// per-effect override. Single-target selectors populate `target` and
// clear `targets`; multi-target selectors populate `targets` and clear
// `target`. The caster is never overridden.
function rescope(ctx: EffectContext, selector: TargetSelector): EffectContext {
  const resolved = resolveTargetSelector(selector, ctx)
  if (resolved.length === 1) {
    return { ...ctx, target: resolved[0], targets: undefined }
  }
  return { ...ctx, target: undefined, targets: resolved as readonly Unit[] }
}
