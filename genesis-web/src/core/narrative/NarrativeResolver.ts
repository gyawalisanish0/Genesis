// Pure resolver functions — no side effects, no UI.

import type { NarrativeEntry, NarrativeEvent, DialogueLine } from './types'

/** Find all entries that match a fired event, respecting the `once` guard. */
function matchingEntries(
  event:    NarrativeEvent,
  entries:  NarrativeEntry[],
  shownIds: ReadonlySet<string>,
): NarrativeEntry[] {
  return entries.filter((entry) => {
    const t = entry.trigger
    if (!t) return false
    if (t.event    && t.event    !== event.type)     return false
    if (t.actorId  && t.actorId  !== event.actorId)  return false
    if (t.targetId && t.targetId !== event.targetId) return false
    if (entry.once && shownIds.has(entry.narrativeId)) return false
    if (t.chance !== undefined && Math.random() > t.chance) return false
    return true
  })
}

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Resolve the best matching entry for a fired event.
 * When multiple entries match, priority decides; ties are broken randomly.
 * Returns null when nothing matches.
 */
export function resolveByEvent(
  event:    NarrativeEvent,
  entries:  NarrativeEntry[],
  shownIds: ReadonlySet<string>,
): NarrativeEntry | null {
  const candidates = matchingEntries(event, entries, shownIds)
  if (!candidates.length) return null
  const maxPriority = Math.max(...candidates.map((e) => e.priority ?? 0))
  const topTier     = candidates.filter((e) => (e.priority ?? 0) === maxPriority)
  return pickRandom(topTier)
}

/** Find an entry by its exact narrativeId. */
export function resolveById(
  narrativeId: string,
  entries:     NarrativeEntry[],
): NarrativeEntry | null {
  return entries.find((e) => e.narrativeId === narrativeId) ?? null
}

/** Pick one line at random (used for non-sequential entries). */
export function pickLine(entry: NarrativeEntry): DialogueLine | null {
  const lines = entry.lines ?? []
  return pickRandom(lines)
}
