// Hook for registering a screen's back-button handler with the global input registry.
// Returns the same callback for attaching to on-screen UI back buttons so hardware
// back and UI back always invoke identical logic.
//
// Usage:
//   const handleBack = useBackButton(() => { /* your back logic */ })
//   <button onPointerDown={handleBack}>←</button>

import { useEffect, useRef, useCallback } from 'react'
import { registerBackHandler, unregisterBackHandler } from './backButtonRegistry'

export function useBackButton(handler: () => void): () => void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler  // always up-to-date; no stale closure

  useEffect(() => {
    // Register a stable wrapper — handler stays current via ref without re-registration.
    registerBackHandler(() => handlerRef.current())
    // Push sentinel at the current URL so browser back stays on this hash;
    // no hash change means only popstate fires (not hashchange), letting the
    // capture-phase listener in ScreenContext intercept it cleanly.
    window.history.pushState(null, '')
    return () => { unregisterBackHandler() }
  }, [])  // intentionally empty — ref keeps this current

  return useCallback(() => { handlerRef.current() }, [])
}
