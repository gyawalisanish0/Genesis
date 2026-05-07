// ─────────────────────────────────────────────────────────────────────────────
// Builtins registration
//
// Registers every shipped primitive into the effect registry. Call
// `registerBuiltins()` once at engine boot; tests may call it after a
// `__resetRegistry()` between cases.
// ─────────────────────────────────────────────────────────────────────────────

import { register as registerDamage }      from './damage'
import { register as registerHeal }        from './heal'
import { register as registerGainAp }      from './gainAp'
import { register as registerSpendAp }     from './spendAp'
import { register as registerTickShove }   from './tickShove'
import { register as registerModifyStat }  from './modifyStat'
import { register as registerApplyStatus } from './applyStatus'

export function registerBuiltins(): void {
  registerDamage()
  registerHeal()
  registerGainAp()
  registerSpendAp()
  registerTickShove()
  registerModifyStat()
  registerApplyStatus()
}
