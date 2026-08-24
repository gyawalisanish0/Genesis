// Frame playback for a sprite state. Steps a frame index at the manifest's
// frameRate; `repeat: -1` loops, `0` plays once and holds the last frame.
// Stepped by construction — there is no tween between frames.

import { useEffect, useRef, useState } from 'react'
import type { AnimationStateDef } from '../core/types'

/** Current frame index for `entry`, restarting whenever `stateKey` changes. */
export function useSpriteFrames(stateKey: string | null, entry: AnimationStateDef | null): number {
  const [frame, setFrame] = useState(0)
  const frameRef = useRef(0)

  useEffect(() => {
    frameRef.current = 0
    setFrame(0)
    if (!entry || entry.frames <= 1) return

    const intervalMs = 1000 / (entry.frameRate || 1)
    const loops = entry.repeat === -1

    const id = setInterval(() => {
      const next = frameRef.current + 1
      if (next >= entry.frames) {
        if (!loops) { clearInterval(id); return }
        frameRef.current = 0
      } else {
        frameRef.current = next
      }
      setFrame(frameRef.current)
    }, intervalMs)

    return () => clearInterval(id)
  }, [stateKey, entry])

  return frame
}
