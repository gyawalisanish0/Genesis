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
import { register as registerApplyStatus }        from './applyStatus'
import { register as registerSecondaryResource }  from './secondaryResource'
import { register as registerResetApAccum }       from './resetApAccum'

export function registerBuiltins(): void {
  registerDamage()
  registerHeal()
  registerGainAp()
  registerSpendAp()
  registerTickShove()
  registerModifyStat()
  registerApplyStatus()
  registerSecondaryResource()
  registerResetApAccum()
}
