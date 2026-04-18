// Zustand store — replaces Python GameContext dataclass + App.settings dict.
// Import `useGameStore` anywhere in the React tree; no provider needed.

import { create } from 'zustand'
import type { Unit, ModeDef, BattleResult, AppSettings } from './types'
import { DEFAULT_SETTINGS } from './constants'

interface GameStore {
  // Pre-battle selections
  selectedMode:    ModeDef | null
  selectedTeam:    Unit[]
  selectedTeamIds: string[]   // character IDs confirmed at pre-battle step 3
  enemies:         Unit[]

  // Post-battle
  battleResult:  BattleResult | null

  // Persisted preferences
  settings: AppSettings

  // Actions
  setSelectedMode(mode: ModeDef): void
  setSelectedTeam(team: Unit[]): void
  setSelectedTeamIds(ids: string[]): void
  setEnemies(enemies: Unit[]): void
  setBattleResult(result: BattleResult): void
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void
  resetBattle(): void
}

export const useGameStore = create<GameStore>((set) => ({
  selectedMode:    null,
  selectedTeam:    [],
  selectedTeamIds: [],
  enemies:         [],
  battleResult:    null,
  settings:        { ...DEFAULT_SETTINGS },

  setSelectedMode:    (mode)    => set({ selectedMode: mode }),
  setSelectedTeam:    (team)    => set({ selectedTeam: team }),
  setSelectedTeamIds: (ids)     => set({ selectedTeamIds: ids }),
  setEnemies:         (enemies) => set({ enemies }),
  setBattleResult:    (result)  => set({ battleResult: result }),

  updateSetting: (key, value) =>
    set((s) => ({ settings: { ...s.settings, [key]: value } })),

  resetBattle: () =>
    set({ selectedMode: null, selectedTeam: [], selectedTeamIds: [], enemies: [], battleResult: null }),
}))
