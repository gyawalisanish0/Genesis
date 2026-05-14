// spawnUnit — requests spawning a CharacterDef-based unit into battle.
// The actual spawn is handled by BattleContext via SpawnBus to keep core/ React-free.

import { registerEffect }      from '../registry'
import { requestSpawn }        from '../../combat/SpawnBus'
import type { Effect, EffectHandler } from '../types'

type SpawnUnitEffect = Extract<Effect, { type: 'spawnUnit' }>

const handle: EffectHandler<SpawnUnitEffect> = (effect, ctx) => {
  requestSpawn({
    defId:        effect.defId,
    isAlly:       ctx.caster.isAlly,
    attackTarget: effect.attackTarget,
    currentTick:  ctx.currentTick ?? 0,
  })
}

export function register(): void {
  registerEffect('spawnUnit', handle)
}
