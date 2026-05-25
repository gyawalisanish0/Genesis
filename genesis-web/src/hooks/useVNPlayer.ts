// useVNPlayer — manages progression through a VNScriptDef.
// Handles typewriter, speed/effect/sfx/autoAdvance, transitions, inputs.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VNScriptDef, VNLine, VNDialogueLine } from '../core/types'
import { SoundService } from '../services/SoundService'

const SPEAKER_SPEED: Partial<Record<string, number>> = {
  creator: 45, player: 28, kali: 22, commander: 30, celan: 30, narration: 38,
}
const NAMED_SPEED = { slow: 55, normal: 30, fast: 15 } as const
const WAKE_FLASH_IN_MS = 350
const WAKE_TOTAL_MS    = 950

function charSpeed(line: VNDialogueLine): number {
  if (line.speed === undefined)        return SPEAKER_SPEED[line.who] ?? 30
  if (typeof line.speed === 'number')  return line.speed
  return NAMED_SPEED[line.speed]
}

function resolveText(text: string, inputs: Record<string, string>): string {
  return text
    .replace(/\[NAME\]/g, inputs.commanderName    ?? '')
    .replace(/\[ORG\]/g,  inputs.organisationName ?? '')
}

export interface VNPlayerState {
  line:          VNLine | null
  fullText:      string
  canvasPhase:   'dark' | 'light'
  transitioning: boolean
  charCount:     number
  isComplete:    boolean
  inputs:        Record<string, string>
  inputDraft:    string
  setInputDraft: (v: string) => void
  advance:       () => void
  confirmInput:  () => void
}

export function useVNPlayer(
  script:           VNScriptDef | null,
  onComplete:       () => void,
  onInputConfirmed: (key: string, value: string) => void,
): VNPlayerState {
  const [lineIdx,       setLineIdx]       = useState(0)
  const [charCount,     setCharCount]     = useState(0)
  const [isComplete,    setIsComplete]    = useState(false)
  const [canvasPhase,   setCanvasPhase]   = useState<'dark' | 'light'>('dark')
  const [transitioning, setTransitioning] = useState(false)
  const [inputs,        setInputs]        = useState<Record<string, string>>({})
  const [inputDraft,    setInputDraft]    = useState('')

  const timerRef       = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef  = useRef(onComplete)
  const onConfirmedRef = useRef(onInputConfirmed)
  onCompleteRef.current  = onComplete
  onConfirmedRef.current = onInputConfirmed

  const lines  = script?.lines ?? []
  const line   = lines[lineIdx] ?? null
  const isLast = lineIdx >= lines.length - 1

  const fullText = line?.kind === 'dialogue' ? resolveText(line.text, inputs) : ''

  function clearTimers() {
    if (timerRef.current)    { clearTimeout(timerRef.current);    timerRef.current    = null }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  function next() {
    if (isLast) { onCompleteRef.current(); return }
    setLineIdx(i => i + 1)
    setInputDraft('')
  }

  useEffect(() => {
    if (!line) return
    clearTimers()
    setIsComplete(false)

    if (line.kind === 'transition') {
      setTransitioning(true)
      const t1 = setTimeout(() => setCanvasPhase('light'), WAKE_FLASH_IN_MS)
      const t2 = setTimeout(() => { setTransitioning(false); setLineIdx(i => i + 1) }, WAKE_TOTAL_MS)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }

    if (line.kind === 'pause') {
      timerRef.current = setTimeout(next, line.duration)
      return clearTimers
    }

    if (line.kind === 'input') return

    const text  = resolveText(line.text, inputs)
    const speed = charSpeed(line)
    if (line.sfx) { try { SoundService.playSfx(line.sfx) } catch {} }

    if (speed === 0) {
      setCharCount(text.length); setIsComplete(true)
      if (line.autoAdvance !== undefined) {
        timerRef.current = setTimeout(next, line.autoAdvance)
        return clearTimers
      }
      return
    }

    setCharCount(0)
    intervalRef.current = setInterval(() => {
      setCharCount(prev => {
        const n = prev + 1
        if (n >= text.length) {
          clearInterval(intervalRef.current!); intervalRef.current = null
          setIsComplete(true)
          if (line.autoAdvance !== undefined) {
            timerRef.current = setTimeout(next, line.autoAdvance)
          }
        }
        return n
      })
    }, speed)

    return clearTimers
  }, [lineIdx, script]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    if (!line || line.kind !== 'dialogue') return
    if (!isComplete) {
      clearTimers()
      setCharCount(fullText.length)
      setIsComplete(true)
      if (line.autoAdvance !== undefined) timerRef.current = setTimeout(next, line.autoAdvance)
      return
    }
    next()
  }, [line, isComplete, fullText]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmInput = useCallback(() => {
    if (!line || line.kind !== 'input') return
    const value = inputDraft.trim()
    if (!value) return
    setInputs(prev => ({ ...prev, [line.inputKey]: value }))
    onConfirmedRef.current(line.inputKey, value)
    next()
  }, [line, inputDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    line, fullText, canvasPhase, transitioning, charCount, isComplete,
    inputs, inputDraft, setInputDraft, advance, confirmInput,
  }
}
