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
import { characterStatusIconUrl } from '../services/DataService'
import { useArenaStage } from './useArenaStage'
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

  const isAlly = (id: string | null) =>
    !!id && (allyDefIds ? allyDefIds.has(id) : s.turn?.isAlly !== false && id === s.actingDefId)

  // Stage whichever pair is in the current exchange, each on its own side.
  const allyDefId  = isAlly(s.actingDefId) ? s.actingDefId : isAlly(s.targetDefId) ? s.targetDefId : null
  const enemyDefId = allyDefId === s.actingDefId ? s.targetDefId : s.actingDefId
  const allyInfo   = (s.turn?.isAlly === false ? s.turn.target : s.turn?.actor) ?? playerFigureInfo ?? null
  const enemyInfo  = (s.turn?.isAlly === false ? s.turn.actor  : s.turn?.target) ?? null

  // TurnDisplayUnitData carries slots but not the unit, so icon URLs (which need
  // a defId) resolve against whichever combatant is being drawn.
  const chipsFor = (info: TurnDisplayUnitData | null, defId: string | null): StatusChipData[] => {
    if (!info || !resolveChip || !defId) return []
    return info.statusSlots.flatMap((slot) => {
      const chip = resolveChip(slot.id)
      if (!chip) return []
      return [{
        slotId:          slot.id,
        label:           chip.label,
        colour:          chip.colour,
        durationDisplay: chip.durationDisplay,
        duration:        slot.duration > 0 ? slot.duration : slot.stacks,
        iconUrl:         chip.icon ? characterStatusIconUrl(defId, chip.icon) : undefined,
        description:     chip.description,
        portraitGlow:    chip.portraitGlow,
      }]
    })
  }

  const actor = (defId: string, info: TurnDisplayUnitData | null, facing: 'front' | 'back') => (
    <SpriteActor
      defId={defId} name={info?.name ?? defId} facing={facing}
      manifest={s.manifests.get(defId)} isDamaged={s.damaged.has(defId)}
      dead={s.dead.has(defId)} acting={s.actingDefId === defId}
    />
  )

  return (
    <div className={styles.arena}>
      <div className={styles.enemyRow}>
        {enemyInfo && <CombatantPlate info={enemyInfo} side="enemy" chips={chipsFor(enemyInfo, enemyDefId)} onChipTap={onChipTap} />}
        {enemyDefId && actor(enemyDefId, enemyInfo, 'front')}
        {s.damage?.defId === enemyDefId && <span className={styles.damage}>−{s.damage.amount}</span>}
      </div>

      <div className={styles.centre}>
        {s.dice     && <span className={styles.dice}>{s.dice}</span>}
        {s.feedback && <span className={styles.feedback} style={{ color: s.feedback.colour }}>{s.feedback.text}</span>}
      </div>

      <div className={styles.allyRow}>
        {allyDefId && actor(allyDefId, allyInfo, 'back')}
        {allyInfo && <CombatantPlate info={allyInfo} side="ally" chips={chipsFor(allyInfo, allyDefId)} onChipTap={onChipTap} />}
        {s.damage?.defId === allyDefId && <span className={styles.damage}>−{s.damage.amount}</span>}
      </div>
    </div>
  )
})
