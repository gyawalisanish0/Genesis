// useArenaStage — the mutable stage state behind BattleArenaHandle.
//
// The engine writes far faster than React renders, so stage state lives in a ref
// and re-renders are forced explicitly. Kept apart from SpriteArena so the
// component stays presentational.

import { useImperativeHandle, useReducer, useRef, useEffect } from 'react'
import type { Ref } from 'react'
import type { AnimationManifest, AnimPhase } from '../core/types'
import type { DiceOutcome } from '../core/combat/DiceResolver'
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
  /** The attack currently playing — the six params playAttack used to discard. */
  attack:      AttackRequest | null
}

/** Everything needed to replay an attack's authored (or default) choreography. */
export interface AttackRequest {
  actingDefId: string
  targetDefId: string
  outcome:     DiceOutcome
  isMelee:     boolean
  dashDx:      number
  sequence:    AnimPhase[] | undefined
  /** Bumped per attack so a repeat of the same attack replays. */
  key:         number
}

const emptyStage = (): StageState => ({
  actingDefId: null, targetDefId: null, manifests: new Map(), damaged: new Set(),
  dead: new Set(), dice: null, feedback: null, damage: null, turn: null, attack: null,
})

let attackSeq = 0

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
    playAttack(actingDefId, targetDefId, outcome, damage, isMelee, dashDx, _projectile, feedbackText, feedbackColour, customSequence) {
      const s = stageRef.current
      // customSequence used to be dropped by arity — the implementation bound
      // nine of the ten declared parameters, so every authored choreography in
      // anim_sequence.json was silently discarded on arrival.
      s.attack = {
        actingDefId, targetDefId, isMelee, dashDx,
        outcome:  outcome as DiceOutcome,
        sequence: customSequence,
        key:      ++attackSeq,
      }
      s.feedback = { text: feedbackText, colour: feedbackColour }
      s.damage   = damage > 0 ? { defId: targetDefId, amount: damage } : null
      // Impact body only when something actually connected — the outcome sting
      // is the DiceRoll's job, so a whiff stays silent here rather than doubling.
      if (damage > 0) SoundService.playSfx('impact')
      after(ANIM_TIMEOUT_MS, () => { s.feedback = null; s.damage = null; s.attack = null })
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
