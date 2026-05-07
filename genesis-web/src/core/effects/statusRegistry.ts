// In-memory registry for StatusDef objects.
// Populated at battle load time; read synchronously by applyStatus handler.

import type { StatusDef } from './types'

const registry = new Map<string, StatusDef>()

export function registerStatusDef(def: StatusDef): void {
  registry.set(def.id, def)
}

export function getStatusDef(id: string): StatusDef | undefined {
  return registry.get(id)
}

export function clearStatusRegistry(): void {
  registry.clear()
}
