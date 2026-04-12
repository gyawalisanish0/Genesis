// ─────────────────────────────────────────────────────────────────────────────
// Builtins registration
//
// Registers every shipped primitive into the effect registry. Call
// `registerBuiltins()` once at engine boot; tests may call it after a
// `__resetRegistry()` between cases.
// ─────────────────────────────────────────────────────────────────────────────

import { register as registerDamage } from './damage'
import { register as registerHeal }   from './heal'

export function registerBuiltins(): void {
  registerDamage()
  registerHeal()
}
