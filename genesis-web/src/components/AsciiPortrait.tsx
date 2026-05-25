// AsciiPortrait — renders a character's idle ASCII animation inside a portrait frame.
// Loads idle_anim.json via DataService; falls back to generic frames when absent.
// Parent must have container-type: size so 'cqw' units resolve correctly.

import { useEffect, useRef, useState } from 'react'
import { loadAsciiAction } from '../services/DataService'
import styles from './AsciiPortrait.module.css'

const FALLBACK: string[][] = [
  [
    '               ◈                ',
    '              ╱║╲               ',
    '               ║                ',
    '              ╱ ╲               ',
  ],
  [
    '              ·◈·               ',
    '              ╱║╲               ',
    '               ║                ',
    '              ╱ ╲               ',
  ],
]

const FRAME_MS    = 600   // matches FigureAnimator idle frameMs
const BREATH_HOLD = 3     // extra hold multiplier on frame 1 (breathPause)

function trimEmpty(frame: string[]): string[] {
  const blank = /^\s*$/
  let lo = 0, hi = frame.length - 1
  while (lo <= hi && blank.test(frame[lo])) lo++
  while (hi >= lo && blank.test(frame[hi])) hi--
  return frame.slice(lo, hi + 1)
}

interface Props {
  defId:      string
  greyscale?: boolean
}

export function AsciiPortrait({ defId, greyscale }: Props) {
  const [frames,     setFrames]     = useState<string[][]>(FALLBACK)
  const [frameIndex, setFrameIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadAsciiAction(defId, 'idle').then((data) => {
      if (data?.frames?.length) {
        setFrames(data.frames)
        setFrameIndex(0)
      }
    })
  }, [defId])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const hold = frameIndex === 1 ? FRAME_MS * BREATH_HOLD : FRAME_MS
    timerRef.current = setTimeout(
      () => setFrameIndex((i) => (i + 1) % frames.length),
      hold,
    )
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [frameIndex, frames])

  const rows = trimEmpty(frames[frameIndex] ?? FALLBACK[0])

  return (
    <pre className={`${styles.pre} ${greyscale ? styles.greyscale : ''}`} aria-hidden>
      {rows.join('\n')}
    </pre>
  )
}
