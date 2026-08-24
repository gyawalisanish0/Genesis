// useAnimSequence — replay a planned AnimPhase timeline as transient stage state.
//
// Planning is pure (core/battle/AnimSequence); this only schedules the steps and
// exposes what is currently active. Phases needing art that is not yet authored
// (particles, projectile) are accepted and ignored rather than dropped from the
// schema, so authored sequences stay valid as art lands.

import { useEffect, useRef, useState } from 'react'
import type { AnimPhase } from '../core/types'
import type { DiceOutcome } from '../core/combat/DiceResolver'
import { planSequence, defaultSequence } from '../core/battle/AnimSequence'
import { SHOVE_OUT_MS, EVADE_DODGE_MS, FLASH_HOLD_MS } from '../core/constants'

export type Figure = 'acting' | 'target'

/** What the stage should currently be showing. */
export interface StageFx {
  shove:    Figure | null
  dodge:    Figure | null
  flash:    { figure: Figure; colour?: string } | null
  impact:   boolean
  shake:    number       // 0 = still
  text:     { text: string; colour: string } | null
  /** Sprite state overrides requested by `playAnim`, keyed by figure. */
  anim:     Partial<Record<Figure, string>>
}

const IDLE: StageFx = {
  shove: null, dodge: null, flash: null, impact: false, shake: 0, text: null, anim: {},
}

export interface SequenceRequest {
  sequence: AnimPhase[] | undefined
  outcome:  DiceOutcome
  isMelee:  boolean
  /** Changes per attack so a repeat of the same attack replays. */
  key:      number
}

export function useAnimSequence(request: SequenceRequest | null): StageFx {
  const [fx, setFx] = useState<StageFx>(IDLE)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (!request) { setFx(IDLE); return }

    const { sequence, outcome, isMelee } = request
    const steps = planSequence(sequence?.length ? sequence : defaultSequence(isMelee), outcome)

    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)) }
    const patch = (p: Partial<StageFx>) => setFx(prev => ({ ...prev, ...p }))

    setFx(IDLE)

    for (const { atMs, phase } of steps) {
      switch (phase.type) {
        case 'shove':
          at(atMs, () => patch({ shove: 'acting' }))
          at(atMs + SHOVE_OUT_MS, () => patch({ shove: null }))
          break
        case 'evasionDodge':
          at(atMs, () => patch({ dodge: 'target' }))
          at(atMs + EVADE_DODGE_MS, () => patch({ dodge: null }))
          break
        case 'flash':
          at(atMs, () => patch({ flash: { figure: phase.figure, colour: phase.colour } }))
          at(atMs + FLASH_HOLD_MS, () => patch({ flash: null }))
          break
        case 'impact':
          at(atMs, () => patch({ impact: true }))
          at(atMs + FLASH_HOLD_MS * 2, () => patch({ impact: false }))
          break
        case 'cameraShake':
          at(atMs, () => patch({ shake: phase.intensity }))
          at(atMs + phase.duration, () => patch({ shake: 0 }))
          break
        case 'statusText':
          at(atMs, () => patch({ text: { text: phase.text, colour: phase.colour } }))
          break
        case 'playAnim':
          at(atMs, () => setFx(prev => ({ ...prev, anim: { ...prev.anim, [phase.figure]: phase.stateKey } })))
          break
        // damageNumber / feedback are already driven by the arena's own state;
        // particles / projectile / aura await art. Accepted, not yet rendered.
        default:
          break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.key])

  return fx
}
