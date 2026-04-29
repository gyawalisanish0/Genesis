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
  CAMPAIGN:      'campaign',
  DUNGEON:       'dungeon',
} as const satisfies Record<string, ScreenId>

export const SCREEN_REGISTRY: Record<ScreenId, ScreenConfig> = {
  'splash':        { id: 'splash',        path: '/splash',        title: 'Genesis',      safeAreaMode: 'none' },
  'main-menu':     { id: 'main-menu',     path: '/main-menu',     title: 'Main Menu',    safeAreaMode: 'full' },
  'pre-battle':    { id: 'pre-battle',    path: '/pre-battle',    title: 'Select Team',  safeAreaMode: 'full' },
  'battle':        { id: 'battle',        path: '/battle',        title: 'Battle',       safeAreaMode: 'none' },
  'battle-result': { id: 'battle-result', path: '/battle-result', title: 'Victory',      safeAreaMode: 'full' },
  'roster':        { id: 'roster',        path: '/roster',        title: 'Roster',       safeAreaMode: 'full' },
  'settings':      { id: 'settings',      path: '/settings',      title: 'Settings',     safeAreaMode: 'full' },
  'campaign':      { id: 'campaign',      path: '/campaign',      title: 'Campaign',     safeAreaMode: 'full' },
  'dungeon':       { id: 'dungeon',       path: '/dungeon',       title: 'The Outpost',  safeAreaMode: 'none' },
}
