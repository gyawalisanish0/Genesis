// Shared types for the screen handling system.
// Pure TypeScript — zero React, Phaser, or Capacitor imports.

export type ScreenId =
  | 'splash'
  | 'main-menu'
  | 'pre-battle'
  | 'battle'
  | 'battle-result'
  | 'roster'
  | 'settings'

// Controls which device-edge insets get applied as padding.
// 'full'     — all 4 sides: menus, roster, settings
// 'top-only' — top only: battle (game canvas fills the bottom edge)
// 'none'     — no padding: splash or other full-bleed screens
export type SafeAreaMode = 'full' | 'top-only' | 'none'

export interface ScreenConfig {
  id: ScreenId
  path: string           // React Router path, e.g. '/splash'
  title: string          // used for document.title
  safeAreaMode: SafeAreaMode
  canGoBack: boolean     // default back action = history.back()
  exitAppOnBack: boolean // when canGoBack is false, exit the app on back press
}

export interface SafeInsets {
  top: number
  bottom: number
  left: number
  right: number
}

// Per-screen lifecycle hooks registered via useScreen()
export interface ScreenLifecycleHooks {
  onEnter?: () => void
  onLeave?: () => void
  // Return true to mark the back event as handled; false to use the default.
  onBack?: () => boolean
}
