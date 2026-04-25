// NarrativeLayer — global overlay that listens to NarrativeService and renders
// the appropriate animations for each triggered entry.
//
// Mount once in App.tsx (inside the scale container, outside Routes).
// Subscribes to both the event bus and direct-play channel.
// Reads entry definitions from the NarrativeService registry.

import { useCallback, useEffect, useRef, useState } from 'react'
import { NarrativeService }            from '../services/NarrativeService'
import { resolveByEvent, resolveById } from '../core/narrative'
import { NarrativeDialogueOverlay }    from './NarrativeDialogueOverlay'
import { NarrativeScreenFlash }        from './NarrativeScreenFlash'
import { NarrativePortraitFlyIn }      from './NarrativePortraitFlyIn'
import { NarrativeFloatingText }       from './NarrativeFloatingText'
import type { NarrativeEntry, NarrativeEvent } from '../core/narrative'
import type { Unit } from '../core/types'
import styles from './NarrativeLayer.module.css'

// ── Unit registry ─────────────────────────────────────────────────────────────
// Any screen can push its active units so portrait fly-ins can find speakers.

const unitRegistry: Unit[] = []

export const NarrativeUnits = {
  register(units: Unit[]): void {
    unitRegistry.length = 0
    for (const u of units) unitRegistry.push(u)
  },
  clear(): void {
    unitRegistry.length = 0
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NarrativeLayer() {
  const [currentEntry, setCurrentEntry] = useState<NarrativeEntry | null>(null)
  // Count of animations still running for the current entry.
  const pendingRef  = useRef(0)
  const shownIds    = useRef(new Set<string>())

  // Expose units to sub-components — snapshot at entry time so layout is stable.
  const [activeUnits, setActiveUnits] = useState<Unit[]>([])

  const tryShow = useCallback((entry: NarrativeEntry) => {
    setCurrentEntry((prev) => {
      if (prev) {
        const prevPriority = prev.priority ?? 0
        const nextPriority = entry.priority ?? 0
        if (prevPriority > nextPriority) return prev  // keep higher-priority active entry
      }
      if (entry.once) shownIds.current.add(entry.narrativeId)
      setActiveUnits([...unitRegistry])
      return entry
    })
  }, [])

  const handleEvent = useCallback((event: NarrativeEvent) => {
    const entries = NarrativeService.getAllEntries()
    const match   = resolveByEvent(event, entries, shownIds.current)
    if (match) tryShow(match)
  }, [tryShow])

  const handleDirect = useCallback((narrativeId: string) => {
    const entries = NarrativeService.getAllEntries()
    const match   = resolveById(narrativeId, entries)
    if (match) tryShow(match)
  }, [tryShow])

  useEffect(() => {
    const unsubEvent  = NarrativeService.subscribe(handleEvent)
    const unsubDirect = NarrativeService.subscribeDirect(handleDirect)
    return () => { unsubEvent(); unsubDirect() }
  }, [handleEvent, handleDirect])

  // Called by each animation child when it finishes.
  const onAnimationDone = useCallback(() => {
    pendingRef.current -= 1
    if (pendingRef.current <= 0) {
      pendingRef.current = 0
      setCurrentEntry(null)
    }
  }, [])

  // When a new entry mounts, initialise the pending counter.
  useEffect(() => {
    if (!currentEntry) return
    pendingRef.current = currentEntry.animations.length || 1
  }, [currentEntry])

  // Freeze the battle for the duration of any dialogue animation.
  // Cleanup fires the instant currentEntry clears → instant resume.
  const hasDialogue = currentEntry?.animations.some((a) => a.type === 'dialogue') ?? false
  useEffect(() => {
    if (!hasDialogue) return
    NarrativeService._signalPause()
    return () => { NarrativeService._signalResume() }
  }, [hasDialogue])

  if (!currentEntry) return null

  const isBlocking = currentEntry.blocking === true

  return (
    <div className={`${styles.layer} ${isBlocking ? styles.blocking : ''}`}>
      {currentEntry.animations.map((anim, i) => {
        switch (anim.type) {
          case 'dialogue':
            return (
              <NarrativeDialogueOverlay
                key={`dialogue-${i}`}
                entry={currentEntry}
                units={activeUnits}
                onDismiss={onAnimationDone}
              />
            )
          case 'screen_flash':
            return (
              <NarrativeScreenFlash
                key={`flash-${i}`}
                colour={anim.colour}
                duration={anim.duration}
                onDone={onAnimationDone}
              />
            )
          case 'portrait_fly':
            return (
              <NarrativePortraitFlyIn
                key={`fly-${i}`}
                speakerId={anim.speakerId}
                side={anim.side}
                duration={anim.duration}
                units={activeUnits}
                onDone={onAnimationDone}
              />
            )
          case 'floating_text':
            return (
              <NarrativeFloatingText
                key={`float-${i}`}
                text={anim.text}
                colour={anim.colour}
                onDone={onAnimationDone}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
