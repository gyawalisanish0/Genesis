// Global registry for hardware/browser back-button dispatch.
// Holds at most one active handler — the current screen's handler.
// Screens register via useBackButton(); ScreenContext dispatches here.

type BackHandler = () => void

let currentHandler: BackHandler | null = null

export function registerBackHandler(fn: BackHandler): void {
  currentHandler = fn
}

export function unregisterBackHandler(): void {
  currentHandler = null
}

export function hasBackHandler(): boolean {
  return currentHandler !== null
}

export function invokeBackHandler(): void {
  currentHandler?.()
}
