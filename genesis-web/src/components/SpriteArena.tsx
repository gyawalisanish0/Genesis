// SpriteArena — the GBA duel frame.
//
// Two combatants in the classic diagonal: enemy front-facing upper-right with
// its plate upper-left, ally back-facing lower-left with its plate lower-right.
// Which two are staged comes straight from the engine's setTurnState(acting,
// target), so a party larger than one shows whoever is currently in the
// exchange. Spec: docs/ui/02-screens.md § Battle.

import { forwardRef } from 'react'
import type { AnimationManifest, AnimationProjectileDef, AnimPhase, StatusChipDef } from '../core/types'
import type { TurnDisplayData, TurnDisplayUnitData } from '../core/battle/EngineTypes'
import type { StatusChipData } from './StatusChipBar'
import { chipsForSlots } from './statusChips'
import { useArenaStage } from './useArenaStage'
import { useAnimSequence } from './useAnimSequence'
import { SpriteActor } from './SpriteActor'
import { CombatantPlate } from './CombatantPlate'
import styles from './SpriteArena.module.css'

export type { TurnDisplayData, TurnDisplayUnitData }

// ── Handle: the contract BattleEngine drives (unchanged) ──────────────────────

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
  /** DefIds on the player's side — decides which slot a combatant occupies. */
  allyDefIds?:       ReadonlySet<string>
  resolveChip?:      (id: string) => StatusChipDef | null
  onChipTap?:        (chip: StatusChipData) => void
}

export const SpriteArena = forwardRef<BattleArenaHandle, Props>(
function SpriteArena({ playerFigureInfo, allyDefIds, resolveChip, onChipTap }, ref) {
  const s = useArenaStage(ref)
  // Replays the attack's authored choreography, or the built-in default whose
  // branch makes Evade and Fail read differently.
  const fx = useAnimSequence(s.attack && {
    sequence: s.attack.sequence,
    outcome:  s.attack.outcome,
    isMelee:  s.attack.isMelee,
    key:      s.attack.key,
  })

  const isAlly = (id: string | null) =>
    !!id && (allyDefIds ? allyDefIds.has(id) : s.turn?.isAlly !== false && id === s.actingDefId)

  // Stage whichever pair is in the current exchange, each on its own side.
  const allyDefId  = isAlly(s.actingDefId) ? s.actingDefId : isAlly(s.targetDefId) ? s.targetDefId : null
  const enemyDefId = allyDefId === s.actingDefId ? s.targetDefId : s.actingDefId
  const allyInfo   = (s.turn?.isAlly === false ? s.turn.target : s.turn?.actor) ?? playerFigureInfo ?? null
  const enemyInfo  = (s.turn?.isAlly === false ? s.turn.actor  : s.turn?.target) ?? null

  // TurnDisplayUnitData carries slots but not the unit, so the defId of whichever
  // combatant is being drawn supplies the icon path.
  const chipsFor = (info: TurnDisplayUnitData | null, defId: string | null): StatusChipData[] =>
    info && resolveChip && defId ? chipsForSlots(info.statusSlots, defId, resolveChip) : []

  /** Which animation role this combatant plays in the current attack. */
  const roleOf = (defId: string): 'acting' | 'target' | null =>
    !s.attack ? null
      : s.attack.actingDefId === defId ? 'acting'
      : s.attack.targetDefId === defId ? 'target'
      : null

  const actor = (defId: string, info: TurnDisplayUnitData | null, facing: 'front' | 'back') => {
    const role = roleOf(defId)
    return (
      <SpriteActor
        defId={defId} name={info?.name ?? defId} facing={facing}
        manifest={s.manifests.get(defId)} isDamaged={s.damaged.has(defId)}
        dead={s.dead.has(defId)} acting={s.actingDefId === defId}
        shoving={role !== null && fx.shove === role}
        dodging={role !== null && fx.dodge === role}
        flashColour={role !== null && fx.flash?.figure === role ? (fx.flash.colour ?? 'var(--text-primary)') : null}
        stateOverride={role ? fx.anim[role] : undefined}
      />
    )
  }

  return (
    <div className={`${styles.arena} ${fx.shake > 0 ? styles.shaking : ''}`}>
      <div className={styles.enemyRow}>
        {enemyInfo && <CombatantPlate info={enemyInfo} side="enemy" chips={chipsFor(enemyInfo, enemyDefId)} onChipTap={onChipTap} />}
        {enemyDefId && actor(enemyDefId, enemyInfo, 'front')}
        {s.damage?.defId === enemyDefId && <span className={styles.damage}>−{s.damage.amount}</span>}
      </div>

      <div className={styles.centre}>
        {s.dice     && <span className={styles.dice}>{s.dice}</span>}
        {s.feedback && <span className={styles.feedback} style={{ color: s.feedback.colour }}>{s.feedback.text}</span>}
        {fx.text && <span className={styles.feedback} style={{ color: fx.text.colour }}>{fx.text.text}</span>}
        {fx.impact && <span className={styles.impact} />}
      </div>

      <div className={styles.allyRow}>
        {allyDefId && actor(allyDefId, allyInfo, 'back')}
        {allyInfo && <CombatantPlate info={allyInfo} side="ally" chips={chipsFor(allyInfo, allyDefId)} onChipTap={onChipTap} />}
        {s.damage?.defId === allyDefId && <span className={styles.damage}>−{s.damage.amount}</span>}
      </div>
    </div>
  )
})
