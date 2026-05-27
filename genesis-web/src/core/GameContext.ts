// Zustand store — replaces Python GameContext dataclass + App.settings dict.
// Import `useGameStore` anywhere in the React tree; no provider needed.

import { create } from 'zustand'
import type { Unit, ModeDef, BattleResult, AppSettings, DungeonState } from './types'
import type { ScreenId } from './screen-types'
import { DEFAULT_SETTINGS } from './constants'

interface GameStore {
  // Pre-battle selections
  selectedMode:    ModeDef | null
  selectedTeam:    Unit[]
  selectedTeamIds: string[]   // character IDs confirmed at pre-battle step 3
  enemies:         Unit[]

  // Post-battle
  battleResult:  BattleResult | null

  // Campaign / dungeon
  dungeonState:              DungeonState | null
  currentEncounterEnemies:   string[]  // defIds — consumed by BattleContext to load characters
  currentEncounterEntityIds: string[]  // entityIds — consumed by DungeonContext to mark party defeated
  returnScreen:              ScreenId | null  // screen to return to after BattleResultScreen

  // Commander identity — set in dream sequence, used by KALI and briefing screens
  commanderName:  string
  organisationName: string

  // Persisted preferences
  settings: AppSettings

  // Actions
  setSelectedMode(mode: ModeDef): void
  setSelectedTeam(team: Unit[]): void
  setSelectedTeamIds(ids: string[]): void
  setEnemies(enemies: Unit[]): void
  setBattleResult(result: BattleResult): void
  setDungeonState(state: DungeonState | null): void
  setCurrentEncounterEnemies(ids: string[]): void
  setCurrentEncounterEntityIds(ids: string[]): void
  setReturnScreen(screen: ScreenId | null): void
  setCommanderName(name: string): void
  setOrganisationName(name: string): void
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void
  resetBattle(): void
}

export const useGameStore = create<GameStore>((set) => ({
  selectedMode:              null,
  selectedTeam:              [],
  selectedTeamIds:           [],
  enemies:                   [],
  battleResult:              null,
  dungeonState:              null,
  currentEncounterEnemies:   [],
  currentEncounterEntityIds: [],
  returnScreen:              null,
  commanderName:            '',
  organisationName:         '',
  settings:                 { ...DEFAULT_SETTINGS },

  setSelectedMode:    (mode)    => set({ selectedMode: mode }),
  setSelectedTeam:    (team)    => set({ selectedTeam: team }),
  setSelectedTeamIds: (ids)     => set({ selectedTeamIds: ids }),
  setEnemies:         (enemies) => set({ enemies }),
  setBattleResult:    (result)  => set({ battleResult: result }),

  setDungeonState:               (state)  => set({ dungeonState: state }),
  setCurrentEncounterEnemies:    (ids)    => set({ currentEncounterEnemies: ids }),
  setCurrentEncounterEntityIds:  (ids)    => set({ currentEncounterEntityIds: ids }),
  setReturnScreen:               (screen) => set({ returnScreen: screen }),
  setCommanderName:           (name)   => set({ commanderName: name }),
  setOrganisationName:        (name)   => set({ organisationName: name }),

  updateSetting: (key, value) =>
    set((s) => ({ settings: { ...s.settings, [key]: value } })),

  resetBattle: () =>
    set({ selectedMode: null, selectedTeam: [], selectedTeamIds: [], enemies: [], battleResult: null }),
}))
