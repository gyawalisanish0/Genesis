// SpawnBus — decoupled channel for unit-spawn requests from the effects system.
// Effect handlers call requestSpawn(); BattleContext registers a handler to process them.
// Keeping this in core/combat/ avoids any React import in the effects system.

export interface SpawnRequest {
  defId:         string
  isAlly:        boolean
  attackTarget?: string   // 'attacker' or a runtime unit id
  currentTick:   number
}

let spawnHandler: ((req: SpawnRequest) => void) | null = null
const pending: SpawnRequest[] = []

export function requestSpawn(req: SpawnRequest): void {
  if (spawnHandler) {
    spawnHandler(req)
  } else {
    pending.push(req)
  }
}

export function registerSpawnHandler(h: (req: SpawnRequest) => void): void {
  spawnHandler = h
  while (pending.length > 0) spawnHandler(pending.shift()!)
}

export function clearSpawnHandler(): void {
  spawnHandler = null
  pending.length = 0
}
