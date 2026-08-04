// SpriteArena — battle stage placeholder for the GBA-era sprite renderer.
//
// The ASCII arena was removed; sprite art is not authored yet. This component
// owns the real BattleArenaHandle contract so BattleEngine keeps driving a live
// stage, and stages combatants in the GBA framing documented in
// docs/ui/02-screens.md (enemy upper-right, ally lower-left). Each combatant
// renders as a labelled slot until sprite sheets land — see
// docs/ui/01-components.md § SpriteActor for the target anatomy.

import { forwardRef, useImperativeHandle, useReducer, useRef } from 'react'
import type { AnimationManifest, AnimationProjectileDef, AnimPhase, StatusChipDef } from '../core/types'
import type { TurnDisplayData, TurnDisplayUnitData } from '../core/battle/EngineTypes'
import type { StatusChipData } from './StatusChipBar'
import { DICE_RESULT_DISMISS_MS, ANIM_TIMEOUT_MS } from '../core/constants'
import styles from './SpriteArena.module.css'

export type { TurnDisplayData, TurnDisplayUnitData }

// ── Handle: the contract BattleEngine drives ──────────────────────────────────

export interface BattleArenaHandle {
  setTurnState(
    actingDefId:     string,
    targetDefId:     string,
    actingManifest?: AnimationManifest | null,
    targetManifest?: AnimationManifest | null,
    isDamaged?:      { acting: boolean; target: boolean },
  ): void
  clearTurn(): void
  playDice(outcome: string): void
  skipActiveDice(): void
  playAttack(
    actingDefId:     string,
    targetDefId:     string,
    outcome:         string,
    damage:          number,
    isMelee:         boolean,
    dashDx:          number,
    projectile:      AnimationProjectileDef | null,
    feedbackText:    string,
    feedbackColour:  string,
    customSequence?: AnimPhase[],
  ): void
  playDeath(defId: string): void
  showTurnDisplay(data: TurnDisplayData): void
  hideTurnDisplay(): void
}

interface Props {
  /** Live leader data shown in the ally slot during the player's turn. */
  playerFigureInfo?: TurnDisplayUnitData
  resolveChip?:      (id: string) => StatusChipDef | null
  onChipTap?:        (chip: StatusChipData) => void
}

// ── Mutable stage state (refs — engine writes far faster than React renders) ──

interface StageState {
  actingDefId: string | null
  targetDefId: string | null
  dead:        Set<string>
  dice:        string | null
  feedback:    { text: string; colour: string } | null
  damage:      { defId: string; amount: number } | null
  turn:        TurnDisplayData | null
}

const emptyStage = (): StageState => ({
  actingDefId: null, targetDefId: null, dead: new Set(),
  dice: null, feedback: null, damage: null, turn: null,
})

export const SpriteArena = forwardRef<BattleArenaHandle, Props>(
function SpriteArena({ playerFigureInfo }, ref) {
  const [, bump]  = useReducer((n: number) => n + 1, 0)
  const stageRef  = useRef<StageState>(emptyStage())
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const after = (ms: number, fn: () => void) => {
    timersRef.current.push(setTimeout(() => { fn(); bump() }, ms))
  }

  useImperativeHandle(ref, () => ({
    setTurnState(actingDefId, targetDefId) {
      stageRef.current.actingDefId = actingDefId
      stageRef.current.targetDefId = targetDefId
      bump()
    },
    clearTurn() {
      stageRef.current.actingDefId = null
      stageRef.current.targetDefId = null
      stageRef.current.damage      = null
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
      stageRef.current.feedback = { text: feedbackText, colour: feedbackColour }
      stageRef.current.damage   = damage > 0 ? { defId: targetDefId, amount: damage } : null
      after(ANIM_TIMEOUT_MS, () => { stageRef.current.feedback = null; stageRef.current.damage = null })
      bump()
    },
    playDeath(defId) {
      stageRef.current.dead.add(defId)
      bump()
    },
    showTurnDisplay(data) { stageRef.current.turn = data; bump() },
    hideTurnDisplay()     { stageRef.current.turn = null; bump() },
  }), [])

  const { actingDefId, targetDefId, dead, dice, feedback, damage, turn } = stageRef.current

  // Ally slot prefers live leader data on the player's turn (turn.actor === null).
  const allyInfo   = turn?.actor ?? playerFigureInfo ?? null
  const enemyInfo  = turn?.target ?? null
  const allyDefId  = turn?.isAlly === false ? targetDefId : actingDefId
  const enemyDefId = turn?.isAlly === false ? actingDefId : targetDefId

  return (
    <div className={styles.arena}>
      <Slot side="enemy" defId={enemyDefId} info={enemyInfo}
            dead={!!enemyDefId && dead.has(enemyDefId)}
            damage={damage?.defId === enemyDefId ? damage.amount : null} />

      <div className={styles.centre}>
        {dice     && <span className={styles.dice}>{dice}</span>}
        {feedback && <span className={styles.feedback} style={{ color: feedback.colour }}>{feedback.text}</span>}
      </div>

      <Slot side="ally" defId={allyDefId} info={allyInfo}
            dead={!!allyDefId && dead.has(allyDefId)}
            damage={damage?.defId === allyDefId ? damage.amount : null} />

      <p className={styles.pending}>sprite art pending</p>
    </div>
  )
})

// ── Combatant slot ────────────────────────────────────────────────────────────

interface SlotProps {
  side:   'ally' | 'enemy'
  defId:  string | null
  info:   TurnDisplayUnitData | null
  dead:   boolean
  damage: number | null
}

function Slot({ side, defId, info, dead, damage }: SlotProps) {
  if (!defId) return <div className={`${styles.slot} ${styles[side]}`} />
  return (
    <div className={`${styles.slot} ${styles[side]} ${dead ? styles.dead : ''}`}>
      <div className={styles.figure} aria-label={info?.name ?? defId}>
        {(info?.name ?? defId).charAt(0).toUpperCase()}
        {damage !== null && <span className={styles.damage}>−{damage}</span>}
      </div>
      {info && (
        <div className={styles.plate}>
          <span className={styles.name}>{info.name}</span>
          <span className={styles.hp}>{info.hp}/{info.maxHp}</span>
        </div>
      )}
    </div>
  )
}
