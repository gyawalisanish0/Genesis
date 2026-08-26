// Zustand store — replaces Python GameContext dataclass + App.settings dict.
// Import `useGameStore` anywhere in the React tree; no provider needed.

import { create } from 'zustand'
import type { Unit, ModeDef, BattleResult, AppSettings, DungeonState } from './types'
import type { ScreenId } from './screen-types'
import { DEFAULT_SETTINGS } from './constants'
import { loadFleet, saveFleet, clearFleet, EMPTY_FLEET, type FleetSave } from './fleetStorage'

/**
 * Write the fleet to disk and hand it back as a store patch.
 *
 * Every fleet mutation persists immediately rather than on a later flush.
 * Recruiting a unit and naming yourself are both moments the demo exists to
 * deliver, and a player who closes the tab straight after one must keep it.
 */
function persistFleet(fleet: FleetSave): { fleet: FleetSave } {
  saveFleet(fleet)
  return { fleet }
}

interface GameStore {
  // Pre-battle selections
  selectedMode:    ModeDef | null
  selectedTeam:    Unit[]
  selectedTeamIds: string[]   // character IDs confirmed at pre-battle step 3
  enemies:         Unit[]

  // Post-battle
  battleResult:  BattleResult | null

  // Campaign / dungeon
  /** Stage the player chose on the campaign screen; the dungeon loads it. */
  selectedStageId:           string | null
  dungeonState:              DungeonState | null
  currentEncounterEnemies:   string[]  // defIds — consumed by BattleContext to load characters
  currentEncounterEntityIds: string[]  // entityIds — consumed by DungeonContext to mark party defeated
  returnScreen:              ScreenId | null  // screen to return to after BattleResultScreen

  // The Commander's fleet — the only state that survives a page load. Holds
  // their identity (named in the opening) as well as recruitedIds (defIds) and
  // completedStages (stageIds). See fleetStorage.ts.
  fleet: FleetSave

  // Persisted preferences
  settings: AppSettings

  // Actions
  setSelectedMode(mode: ModeDef): void
  setSelectedTeam(team: Unit[]): void
  setSelectedTeamIds(ids: string[]): void
  setEnemies(enemies: Unit[]): void
  setBattleResult(result: BattleResult): void
  setSelectedStageId(id: string | null): void
  setDungeonState(state: DungeonState | null): void
  setCurrentEncounterEnemies(ids: string[]): void
  setCurrentEncounterEntityIds(ids: string[]): void
  setReturnScreen(screen: ScreenId | null): void
  setCommanderName(name: string): void
  setOrganisationName(name: string): void
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void
  /** Add units to the fleet and persist. Idempotent — re-recruiting is a no-op. */
  recruitUnits(defIds: string[]): void
  /** Mark a stage cleared and persist. Idempotent. */
  completeStage(stageId: string): void
  /** Wipe the run — fleet, progress, identity — for a fresh playthrough. */
  resetRun(): void
  resetBattle(): void
}

export const useGameStore = create<GameStore>((set) => ({
  selectedMode:              null,
  selectedTeam:              [],
  selectedTeamIds:           [],
  enemies:                   [],
  battleResult:              null,
  selectedStageId:           null,
  dungeonState:              null,
  currentEncounterEnemies:   [],
  currentEncounterEntityIds: [],
  returnScreen:              null,
  fleet:                    loadFleet(),
  settings:                 { ...DEFAULT_SETTINGS },

  setSelectedMode:    (mode)    => set({ selectedMode: mode }),
  setSelectedTeam:    (team)    => set({ selectedTeam: team }),
  setSelectedTeamIds: (ids)     => set({ selectedTeamIds: ids }),
  setEnemies:         (enemies) => set({ enemies }),
  setBattleResult:    (result)  => set({ battleResult: result }),

  setSelectedStageId:            (id)     => set({ selectedStageId: id }),
  setDungeonState:               (state)  => set({ dungeonState: state }),
  setCurrentEncounterEnemies:    (ids)    => set({ currentEncounterEnemies: ids }),
  setCurrentEncounterEntityIds:  (ids)    => set({ currentEncounterEntityIds: ids }),
  setReturnScreen:               (screen) => set({ returnScreen: screen }),
  // Identity writes through for the same reason recruitment does: the player
  // types their name once, and a refresh must not ask them again.
  setCommanderName:    (name) => set((s) => persistFleet({ ...s.fleet, commanderName: name })),
  setOrganisationName: (name) => set((s) => persistFleet({ ...s.fleet, organisationName: name })),

  updateSetting: (key, value) =>
    set((s) => ({ settings: { ...s.settings, [key]: value } })),

  recruitUnits: (defIds) =>
    set((s) => {
      const merged = [...new Set([...s.fleet.recruitedIds, ...defIds])]
      if (merged.length === s.fleet.recruitedIds.length) return s
      return persistFleet({ ...s.fleet, recruitedIds: merged })
    }),

  completeStage: (stageId) =>
    set((s) => {
      if (s.fleet.completedStages.includes(stageId)) return s
      return persistFleet({ ...s.fleet, completedStages: [...s.fleet.completedStages, stageId] })
    }),

  // Replay wipes the save as well as the session. A returning player who chose
  // to run it again should get the same first-time experience, including the
  // recruitment landing as news rather than as a roster they already have.
  resetRun: () => {
    clearFleet()
    set({
      fleet: EMPTY_FLEET,
      selectedStageId: null, dungeonState: null, battleResult: null,
      selectedMode: null, selectedTeam: [], selectedTeamIds: [], enemies: [],
      currentEncounterEnemies: [], currentEncounterEntityIds: [], returnScreen: null,
    })
  },

  resetBattle: () =>
    set({ selectedMode: null, selectedTeam: [], selectedTeamIds: [], enemies: [], battleResult: null }),
}))
