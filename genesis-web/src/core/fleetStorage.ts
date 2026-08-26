// Fleet persistence — the only state in Genesis that outlives a page load.
//
// Everything else in GameContext is a within-session concern: a battle, a
// dungeon run, a pre-battle selection. The fleet is different. Recruiting a
// unit is the payoff the demo is built to deliver, and a demo gets reloaded —
// shown to someone, refreshed, resumed on a phone. Losing the two units you
// just earned to a page refresh undercuts the exact thing the ending teaches.
//
// Deliberately narrow: who the Commander is, who is in their fleet, and which
// stages are cleared. Not mid-dungeon position, not battle state, not
// pre-battle selections — those are all resumable by replaying a few minutes,
// and persisting them would be a save system rather than a fleet.
//
// Identity is here rather than in session state because the player types it
// once, in the opening, and the splash screen uses "has a name" to decide
// whether to play that opening at all. Left in memory, a refresh would send
// someone who already named themselves back through the dream.

const STORAGE_KEY = 'genesis-fleet-v1'

export interface FleetSave {
  /** What the player named themselves in the opening. Empty until then. */
  commanderName:    string
  /** What the player named their organisation. Empty until then. */
  organisationName: string
  /** defIds of every unit recruited into the Commander's fleet. */
  recruitedIds:    string[]
  /** stageIds the Commander has completed. */
  completedStages: string[]
}

export const EMPTY_FLEET: FleetSave = {
  commanderName: '', organisationName: '', recruitedIds: [], completedStages: [],
}

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
      commanderName:    sanitiseName(parsed.commanderName),
      organisationName: sanitiseName(parsed.organisationName),
      recruitedIds:     sanitiseIds(parsed.recruitedIds),
      completedStages:  sanitiseIds(parsed.completedStages),
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

/**
 * A stored name, or empty.
 *
 * Empty is meaningful: it is how the splash screen recognises a player who has
 * not been through the opening yet, so a save written before names were
 * persisted reads as a first run rather than as a broken one.
 */
function sanitiseName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, NAME_MAX_LENGTH) : ''
}

/** Matches the `maxLength` on the field the player types into. */
const NAME_MAX_LENGTH = 24
