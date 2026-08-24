// HintQueue — one-shot hints, shown one at a time.
//
// Rendering several <Toaster onceId> together fires them all at once: on first
// entering battle three hints appeared simultaneously and two were stacked
// unreadably on top of each other. A hint is only useful if it can be read, so
// the queue holds the rest back until the one on screen has had its turn.

import { useState } from 'react'
import { HINT_STORAGE_PREFIX } from '../core/constants'
import { Toaster } from './Toaster'
import type { ToastTone } from './Toaster'

export interface Hint {
  /** Persisted key — a hint is shown once per device, as before. */
  id:        string
  message:   string
  position?: 'top' | 'bottom'
  tone?:     ToastTone
}

function alreadySeen(id: string): boolean {
  try { return localStorage.getItem(`${HINT_STORAGE_PREFIX}${id}`) === '1' }
  catch { return false }
}

interface Props {
  hints: Hint[]
  /** Hold the queue while the screen is busy (loading, mid-animation). */
  paused?: boolean
}

export function HintQueue({ hints, paused = false }: Props) {
  // Hints dismissed in this session. Toaster owns the persisted `onceId` record;
  // this only tracks which have had their turn so the next can start.
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set())

  if (paused) return null
  const next = hints.find(h => !shown.has(h.id) && !alreadySeen(h.id))
  if (!next) return null

  return (
    <Toaster
      key={next.id}
      onceId={next.id}
      message={next.message}
      position={next.position ?? 'top'}
      tone={next.tone}
      onDismiss={() => setShown(prev => new Set(prev).add(next.id))}
    />
  )
}
