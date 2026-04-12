// ─────────────────────────────────────────────────────────────────────────────
// ValueExpr resolver
//
// Turns a ValueExpr (the only mini-syntax in the contract) into a concrete
// number against an EffectContext. Pure function, no side effects.
//
// Resolution rules:
//   • number           → returned as-is
//   • { stat, percent } → caster.stats[stat] * percent / 100 by default,
//                         target.stats[stat] when `of: "target"`
//   • { sum: [...] }   → each sub-expression resolved and summed
// ─────────────────────────────────────────────────────────────────────────────

import type { EffectContext, StatKey, ValueExpr } from './types'
import type { Unit } from '../types'

const PERCENT_DIVISOR = 100

export function resolveValueExpr(expr: ValueExpr, ctx: EffectContext): number {
  if (typeof expr === 'number') return expr
  if ('sum' in expr) return expr.sum.reduce<number>((acc, sub) => acc + resolveValueExpr(sub, ctx), 0)
  return resolveStatExpr(expr.stat, expr.percent, expr.of, ctx)
}

function resolveStatExpr(
  stat:    StatKey,
  percent: number,
  of:      'caster' | 'target' | undefined,
  ctx:     EffectContext,
): number {
  const source = pickStatSource(of ?? 'caster', ctx)
  return (source.stats[stat] * percent) / PERCENT_DIVISOR
}

function pickStatSource(of: 'caster' | 'target', ctx: EffectContext): Unit {
  if (of === 'target') {
    if (!ctx.target) {
      throw new Error('ValueExpr references target stats but no target in context')
    }
    return ctx.target
  }
  return ctx.caster
}
