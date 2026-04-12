// ─────────────────────────────────────────────────────────────────────────────
// Effect handler registry
//
// Primitives in core/effects/builtins/ register themselves against this
// map at import time via `registerEffect`. `getHandler` is the only read
// path — consumers look up a handler by the discriminator on Effect.type
// and fail loudly if no handler is present. This keeps the system open
// to new primitives without a central switch statement anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import type { Effect, EffectHandler, EffectType } from './types'

const handlers = new Map<EffectType, EffectHandler>()

export function registerEffect<T extends Effect['type']>(
  type:    T,
  handler: EffectHandler<Extract<Effect, { type: T }>>,
): void {
  if (handlers.has(type)) {
    throw new Error(`Effect handler already registered: ${type}`)
  }
  handlers.set(type, handler as EffectHandler)
}

export function getHandler(type: EffectType): EffectHandler {
  const handler = handlers.get(type)
  if (!handler) {
    throw new Error(`No effect handler registered for type: ${type}`)
  }
  return handler
}

// Test-only — clears the registry between unit tests.
export function __resetRegistry(): void {
  handlers.clear()
}
