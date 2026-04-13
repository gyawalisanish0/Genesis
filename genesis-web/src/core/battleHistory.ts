// Battle action history — pure types + factory, no UI imports.
// Each entry records a unit's tick position at the moment they took an action.
// Rendered on the timeline as grayscale ghost markers trailing behind live ones.

export interface HistoryEntry {
  id:     string
  unitId: string
  name:   string   // unit display name — first char used as portrait initial
  tick:   number   // tick position at the time the action was taken
  isAlly: boolean
}

/** Snapshot a unit's current tick position before they advance. */
export function makeHistoryEntry(
  unitId: string, name: string, tick: number, isAlly: boolean,
): HistoryEntry {
  return { id: `${unitId}-${tick}-${Date.now()}`, unitId, name, tick, isAlly }
}
