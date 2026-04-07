// Global screen context — provides current screen config, safe-area insets,
// back-button coordination, and document title management.
//
// Must be rendered as a direct child of <HashRouter> (needs useLocation).
// The Capacitor back-button listener lives here — one listener, never re-registered.

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import type { ScreenConfig, SafeInsets } from '../core/screen-types'
import { SCREEN_REGISTRY } from './screenRegistry'

// Fallback insets when env() is unavailable (Android notification bar ~24px,
// home gesture bar ~48px).
const FALLBACK_INSETS: SafeInsets = { top: 24, bottom: 48, left: 0, right: 0 }

// Measures env(safe-area-inset-*) values into JS numbers by creating a temporary
// zero-size element — the only reliable way to read CSS env() from JavaScript.
function readCssSafeInsets(): SafeInsets {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:0', 'height:0', 'visibility:hidden',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
  ].join(';')
  document.body.appendChild(el)
  const s = getComputedStyle(el)
  const result: SafeInsets = {
    top:    parseFloat(s.paddingTop)    || FALLBACK_INSETS.top,
    bottom: parseFloat(s.paddingBottom) || FALLBACK_INSETS.bottom,
    left:   parseFloat(s.paddingLeft)   || FALLBACK_INSETS.left,
    right:  parseFloat(s.paddingRight)  || FALLBACK_INSETS.right,
  }
  document.body.removeChild(el)
  return result
}

interface ScreenContextValue {
  screen: ScreenConfig | null
  safeInsets: SafeInsets
  // Called by useScreen() to register a per-screen back override.
  registerBackHandler: (fn: () => boolean) => void
  unregisterBackHandler: () => void
}

const ScreenContext = createContext<ScreenContextValue>({
  screen: null,
  safeInsets: FALLBACK_INSETS,
  registerBackHandler: () => {},
  unregisterBackHandler: () => {},
})

export function useScreenContext(): ScreenContextValue {
  return useContext(ScreenContext)
}

interface Props { children: ReactNode }

export function ScreenProvider({ children }: Props) {
  const location = useLocation()
  const backHandlerRef = useRef<(() => boolean) | null>(null)
  const screenRef = useRef<ScreenConfig | null>(null)
  const [safeInsets, setSafeInsets] = useState<SafeInsets>(FALLBACK_INSETS)

  // Derive current screen from pathname — re-computed on every navigation.
  const screen = Object.values(SCREEN_REGISTRY).find(
    (cfg) => cfg.path === location.pathname,
  ) ?? null

  // Keep a ref so the Capacitor listener (registered once) always sees the latest screen.
  screenRef.current = screen

  // Read env() insets once after first paint.
  useEffect(() => {
    setSafeInsets(readCssSafeInsets())
  }, [])

  // Update document title on every screen change.
  useEffect(() => {
    document.title = screen?.title ?? 'Genesis'
  }, [screen])

  // Register the Capacitor back-button listener exactly once for the app lifetime.
  // Using refs means route changes never cause a re-register.
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      // 1. Per-screen handler takes priority.
      if (backHandlerRef.current?.()) return

      const cur = screenRef.current
      // 2. Default: navigate back if the screen allows it.
      if (cur?.canGoBack) {
        window.history.back()
      } else if (cur?.exitAppOnBack) {
        // 3. Exit the app (e.g. main menu, splash).
        CapApp.exitApp()
      }
      // battle-result: back does nothing — screen must navigate explicitly
    })
    return () => { sub.then((h) => h.remove()) }
  }, []) // intentionally empty — refs keep this handler current

  const registerBackHandler = useCallback((fn: () => boolean) => {
    backHandlerRef.current = fn
  }, [])

  const unregisterBackHandler = useCallback(() => {
    backHandlerRef.current = null
  }, [])

  return (
    <ScreenContext.Provider value={{ screen, safeInsets, registerBackHandler, unregisterBackHandler }}>
      {children}
    </ScreenContext.Provider>
  )
}
