// Global screen context — provides current screen config, safe-area insets,
// back-button coordination, and document title management.
//
// Must be rendered as a direct child of <HashRouter> (needs useLocation).
// The Capacitor back-button listener lives here — one listener, never re-registered.

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import type { ScreenConfig, SafeInsets } from '../core/screen-types'
import { SCREEN_REGISTRY } from './screenRegistry'
import { invokeBackHandler } from '../input/backButtonRegistry'

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
}

const ScreenContext = createContext<ScreenContextValue>({
  screen: null,
  safeInsets: FALLBACK_INSETS,
})

export function useScreenContext(): ScreenContextValue {
  return useContext(ScreenContext)
}

interface Props { children: ReactNode }

export function ScreenProvider({ children }: Props) {
  const location = useLocation()
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
  // Dispatch is handled entirely by the input registry — no fallback logic here.
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      invokeBackHandler()
    })
    return () => { sub.then((h) => h.remove()) }
  }, []) // intentionally empty — input registry is module-level

  return (
    <ScreenContext.Provider value={{ screen, safeInsets }}>
      {children}
    </ScreenContext.Provider>
  )
}
