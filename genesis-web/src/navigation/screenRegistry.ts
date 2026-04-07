// Central registry of all screens — single source of truth for routing metadata.
// Import SCREEN_IDS for type-safe navigation; never use string literals for routes.

import type { ScreenConfig, ScreenId } from '../core/screen-types'

// Type-safe constants for every screen id.
// Usage: navigate(SCREEN_REGISTRY[SCREEN_IDS.MAIN_MENU].path)
export const SCREEN_IDS = {
  SPLASH:        'splash',
  MAIN_MENU:     'main-menu',
  PRE_BATTLE:    'pre-battle',
  BATTLE:        'battle',
  BATTLE_RESULT: 'battle-result',
  ROSTER:        'roster',
  SETTINGS:      'settings',
} as const satisfies Record<string, ScreenId>

export const SCREEN_REGISTRY: Record<ScreenId, ScreenConfig> = {
  'splash': {
    id: 'splash', path: '/splash', title: 'Genesis',
    safeAreaMode: 'none', canGoBack: false, exitAppOnBack: true,
  },
  'main-menu': {
    id: 'main-menu', path: '/main-menu', title: 'Main Menu',
    safeAreaMode: 'full', canGoBack: false, exitAppOnBack: true,
  },
  'pre-battle': {
    id: 'pre-battle', path: '/pre-battle', title: 'Select Team',
    safeAreaMode: 'full', canGoBack: true, exitAppOnBack: false,
  },
  'battle': {
    id: 'battle', path: '/battle', title: 'Battle',
    safeAreaMode: 'top-only', canGoBack: false, exitAppOnBack: false,
  },
  'battle-result': {
    id: 'battle-result', path: '/battle-result', title: 'Victory',
    safeAreaMode: 'full', canGoBack: false, exitAppOnBack: false,
  },
  'roster': {
    id: 'roster', path: '/roster', title: 'Roster',
    safeAreaMode: 'full', canGoBack: true, exitAppOnBack: false,
  },
  'settings': {
    id: 'settings', path: '/settings', title: 'Settings',
    safeAreaMode: 'full', canGoBack: true, exitAppOnBack: false,
  },
}
