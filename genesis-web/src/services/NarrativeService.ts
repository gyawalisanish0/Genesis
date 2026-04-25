// NarrativeService — global singleton for the narrative layer.
// Any screen or context emits events here; NarrativeLayer subscribes and renders.
//
// Entry namespaces allow different parts of the app to register/unregister
// their own entry sets independently:
//   'characters' — registered at startup by SplashScreen (persists for the session)
//   'level'      — registered when a battle starts, unregistered when it ends

import type { NarrativeEvent, NarrativeEntry } from '../core/narrative'

type EventListener = (event: NarrativeEvent) => void
type PlayListener  = (narrativeId: string) => void
type VoidListener  = () => void

const eventListeners  = new Set<EventListener>()
const playListeners   = new Set<PlayListener>()
const pauseListeners  = new Set<VoidListener>()
const resumeListeners = new Set<VoidListener>()
const entryNamespaces = new Map<string, NarrativeEntry[]>()

export const NarrativeService = {
  // ── Event bus ──────────────────────────────────────────────────────────────

  /** Fire a narrative event — all registered NarrativeLayer instances resolve it. */
  emit(event: NarrativeEvent): void {
    eventListeners.forEach((l) => l(event))
  },

  /** Directly trigger a narrative entry by ID, bypassing event matching. */
  play(narrativeId: string): void {
    playListeners.forEach((l) => l(narrativeId))
  },

  subscribe(listener: EventListener): () => void {
    eventListeners.add(listener)
    return () => eventListeners.delete(listener)
  },

  subscribeDirect(listener: PlayListener): () => void {
    playListeners.add(listener)
    return () => playListeners.delete(listener)
  },

  // ── Battle freeze signals ─────────────────────────────────────────────────
  // Called internally by NarrativeLayer; subscribed to by BattleContext.

  /** Subscribe to receive a signal when a dialogue entry starts (battle should freeze). */
  onNarrativePause(listener: VoidListener): () => void {
    pauseListeners.add(listener)
    return () => pauseListeners.delete(listener)
  },

  /** Subscribe to receive a signal when dialogue dismisses (battle should resume). */
  onNarrativeResume(listener: VoidListener): () => void {
    resumeListeners.add(listener)
    return () => resumeListeners.delete(listener)
  },

  /** Internal — NarrativeLayer calls this when a dialogue animation becomes active. */
  _signalPause(): void {
    pauseListeners.forEach((l) => l())
  },

  /** Internal — NarrativeLayer calls this when the dialogue entry is dismissed. */
  _signalResume(): void {
    resumeListeners.forEach((l) => l())
  },

  // ── Entry registry ─────────────────────────────────────────────────────────

  /** Register a named set of narrative entries. Replaces any previous set for the same namespace. */
  registerEntries(namespace: string, entries: NarrativeEntry[]): void {
    entryNamespaces.set(namespace, entries)
  },

  /** Remove a named entry set (e.g. level narrative when battle ends). */
  unregisterEntries(namespace: string): void {
    entryNamespaces.delete(namespace)
  },

  /** Flat merge of all registered namespaces — used by NarrativeLayer to resolve events. */
  getAllEntries(): NarrativeEntry[] {
    const all: NarrativeEntry[] = []
    for (const entries of entryNamespaces.values()) {
      for (const entry of entries) all.push(entry)
    }
    return all
  },
}
