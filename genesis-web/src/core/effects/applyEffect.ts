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
  const scoped = effect.target ? rescope(ctx, effect.target) : ctx
  if (effect.condition && !evaluateCondition(effect.condition, scoped)) return
  getHandler(effect.type)(effect, scoped)
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
