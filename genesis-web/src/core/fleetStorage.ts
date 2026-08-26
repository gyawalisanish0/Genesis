// Fleet persistence — the only state in Genesis that outlives a page load.
//
// Everything else in GameContext is a within-session concern: a battle, a
// dungeon run, a pre-battle selection. The fleet is different. Recruiting a
// unit is the payoff the demo is built to deliver, and a demo gets reloaded —
// shown to someone, refreshed, resumed on a phone. Losing the two units you
// just earned to a page refresh undercuts the exact thing the ending teaches.
//
// Deliberately narrow: who is in the fleet, and which stages are cleared.
// Not mid-dungeon position, not battle state, not pre-battle selections —
// those are all resumable by replaying a few minutes, and persisting them
// would be a save system rather than a fleet.

const STORAGE_KEY = 'genesis-fleet-v1'

export interface FleetSave {
  /** defIds of every unit recruited into the Commander's fleet. */
  recruitedIds:    string[]
  /** stageIds the Commander has completed. */
  completedStages: string[]
}

export const EMPTY_FLEET: FleetSave = { recruitedIds: [], completedStages: [] }

/**
 * Read the saved fleet.
 *
 * Every failure returns an empty fleet rather than throwing: storage can be
 * unavailable (private browsing, a WebView with site data disabled), the value
 * can be corrupt, or it can predate a schema change. None of those are worth
 * blocking the game over — a player with no readable save is simply a player
 * with no fleet yet.
 */
export function loadFleet(): FleetSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_FLEET
    const parsed = JSON.parse(raw) as Partial<FleetSave>
    return {
      recruitedIds:    sanitiseIds(parsed.recruitedIds),
      completedStages: sanitiseIds(parsed.completedStages),
    }
  } catch {
    return EMPTY_FLEET
  }
}

/** Persist the fleet. Silently a no-op when storage is unavailable. */
export function saveFleet(fleet: FleetSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fleet))
  } catch {
    // Quota, private mode, or a WebView with site data blocked. The session
    // still works; only the persistence is lost.
  }
}

/** Clear the saved fleet — a fresh run. */
export function clearFleet(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* see saveFleet */ }
}

/**
 * Keep only well-formed, unique, non-empty ids.
 *
 * A hand-edited or half-written save must not put `undefined` into a roster
 * that later gets used as a lookup key — that surfaces as a missing character
 * at load time rather than as a storage error.
 */
function sanitiseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))]
}
