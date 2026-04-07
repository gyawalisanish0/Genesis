// Hook consumed by every screen component.
// Provides: current screen config, safe-area insets, type-safe navigation,
// and lifecycle hook registration (onEnter, onLeave, onBack).

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScreenContext } from './ScreenContext'
import { SCREEN_REGISTRY } from './screenRegistry'
import type { ScreenConfig, SafeInsets, ScreenId, ScreenLifecycleHooks } from '../core/screen-types'

interface UseScreenResult {
  screen: ScreenConfig | null
  safeInsets: SafeInsets
  navigateTo: (id: ScreenId) => void
}

export function useScreen(hooks?: ScreenLifecycleHooks): UseScreenResult {
  const { screen, safeInsets, registerBackHandler, unregisterBackHandler } =
    useScreenContext()
  const navigate = useNavigate()

  // Register lifecycle hooks on mount; clean up on unmount.
  // Hook refs are captured at mount time — this is intentional so closures
  // created by the screen at mount time are the ones that fire at unmount.
  useEffect(() => {
    const enter = hooks?.onEnter
    const leave = hooks?.onLeave
    enter?.()
    return () => { leave?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Register per-screen back override. Unregister when the screen unmounts.
  useEffect(() => {
    if (!hooks?.onBack) return
    const handler = hooks.onBack
    registerBackHandler(handler)
    return () => { unregisterBackHandler() }
  }, [hooks?.onBack, registerBackHandler, unregisterBackHandler]) // eslint-disable-line react-hooks/exhaustive-deps

  // Type-safe navigation — always go through the registry so paths stay in one place.
  function navigateTo(id: ScreenId) {
    navigate(SCREEN_REGISTRY[id].path)
  }

  return { screen, safeInsets, navigateTo }
}
