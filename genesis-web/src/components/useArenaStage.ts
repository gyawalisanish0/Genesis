// useArenaStage — the mutable stage state behind BattleArenaHandle.
//
// The engine writes far faster than React renders, so stage state lives in a ref
// and re-renders are forced explicitly. Kept apart from SpriteArena so the
// component stays presentational.

import { useImperativeHandle, useReducer, useRef, useEffect } from 'react'
import type { Ref } from 'react'
import type { AnimationManifest } from '../core/types'
import type { TurnDisplayData } from '../core/battle/EngineTypes'
import { DICE_RESULT_DISMISS_MS, ANIM_TIMEOUT_MS } from '../core/constants'
import { SoundService } from '../services/SoundService'
import type { BattleArenaHandle } from './SpriteArena'

export interface StageState {
  actingDefId: string | null
  targetDefId: string | null
  manifests:   Map<string, AnimationManifest | null>
  damaged:     Set<string>
  dead:        Set<string>
  dice:        string | null
  feedback:    { text: string; colour: string } | null
  damage:      { defId: string; amount: number } | null
  turn:        TurnDisplayData | null
}

const emptyStage = (): StageState => ({
  actingDefId: null, targetDefId: null, manifests: new Map(), damaged: new Set(),
  dead: new Set(), dice: null, feedback: null, damage: null, turn: null,
})

/** Wires `ref` to the engine-facing handle and returns the live stage state. */
export function useArenaStage(ref: Ref<BattleArenaHandle>): StageState {
  const [, bump]  = useReducer((n: number) => n + 1, 0)
  const stageRef  = useRef<StageState>(emptyStage())
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const after = (ms: number, fn: () => void) => {
    timersRef.current.push(setTimeout(() => { fn(); bump() }, ms))
  }

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  useImperativeHandle(ref, () => ({
    setTurnState(actingDefId, targetDefId, actingManifest, targetManifest, isDamaged) {
      const s = stageRef.current
      s.actingDefId = actingDefId
      s.targetDefId = targetDefId
      if (actingManifest !== undefined) s.manifests.set(actingDefId, actingManifest)
      if (targetManifest !== undefined) s.manifests.set(targetDefId, targetManifest)
      const flags = [[actingDefId, isDamaged?.acting], [targetDefId, isDamaged?.target]] as const
      for (const [id, on] of flags) { if (on) s.damaged.add(id); else s.damaged.delete(id) }
      bump()
    },
    clearTurn() {
      const s = stageRef.current
      s.actingDefId = null; s.targetDefId = null; s.damage = null
      bump()
    },
    playDice(outcome) {
      stageRef.current.dice = outcome
      after(DICE_RESULT_DISMISS_MS, () => { stageRef.current.dice = null })
      bump()
    },
    skipActiveDice() {
      stageRef.current.dice = null
      bump()
    },
    playAttack(_actingDefId, targetDefId, _outcome, damage, _isMelee, _dashDx, _projectile, feedbackText, feedbackColour) {
      const s = stageRef.current
      s.feedback = { text: feedbackText, colour: feedbackColour }
      s.damage   = damage > 0 ? { defId: targetDefId, amount: damage } : null
      // Impact body only when something actually connected — the outcome sting
      // is the DiceRoll's job, so a whiff stays silent here rather than doubling.
      if (damage > 0) SoundService.playSfx('impact')
      after(ANIM_TIMEOUT_MS, () => { s.feedback = null; s.damage = null })
      bump()
    },
    playDeath(defId) {
      SoundService.playSfx('death')
      stageRef.current.dead.add(defId)
      bump()
    },
    showTurnDisplay(data) { stageRef.current.turn = data; bump() },
    hideTurnDisplay()     { stageRef.current.turn = null; bump() },
  }), [])

  return stageRef.current
}
