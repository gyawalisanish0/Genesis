// BattleScene — Phaser 3 scene that owns the cinematic battle canvas.
//
// Stage 2: acting unit + target placeholder figures (UnitStage).
// Stage 3: dice spin → attack animation → feedback numbers (phase-gated via onDone).
// Stage 4: screen shake, particle bursts, evasion dodge, death collapse.
// Stage 5: TurnDisplayPanel overlaid at top of canvas (no canvas resize).
//
// React communicates via the public command methods; Phaser communicates back
// to React via the onDone callbacks passed into playDice / playAttack / playDeath.
// The battle log now lives in a React overlay (BattleLogOverlay) — not here.

import Phaser from 'phaser'
import type { AnimationManifest, AnimationProjectileDef } from '../core/types'
import { tokenToHex }       from './battle/tokens'
import { UnitStage }        from './battle/UnitStage'
import { DicePanel }        from './battle/DicePanel'
import { SequenceRunner }   from './battle/SequenceRunner'
import { buildDefaultSequence } from './battle/DefaultSequences'
import type { SequenceContext } from './battle/SequenceTypes'
import { FeedbackPanel }    from './battle/FeedbackPanel'
import { ParticleEmitter, PARTICLE_KEY } from './battle/ParticleEmitter'
import { ProjectilePanel }  from './battle/ProjectilePanel'
import type { DiceOutcome } from '../core/combat/DiceResolver'
import { TurnDisplayPanel, TURN_PANEL_RESERVE } from './battle/TurnDisplayPanel'
import type { TurnPanelData } from './battle/TurnDisplayPanel'
import { BETWEEN_TURN_PAUSE_MS } from '../core/constants'
import { ResolutionAdaptor }    from './battle/ResolutionAdaptor'

const TOP_INSET = TURN_PANEL_RESERVE

// tokenToHex is re-exported so existing importers (UnitStage, ParticleEmitter) can
// migrate to ./battle/tokens at their own pace without a breaking change.
export { tokenToHex }

// ── BattleScene ───────────────────────────────────────────────────────────────

const BG_COLOUR = 0x0a0a14

export class BattleScene extends Phaser.Scene {
  private bg!:               Phaser.GameObjects.Rectangle
  private vignette!:         Phaser.GameObjects.Graphics
  private unitStage!:        UnitStage
  private dicePanel!:        DicePanel
  private sequenceRunner!:   SequenceRunner
  private feedbackPanel!:    FeedbackPanel
  private turnDisplayPanel!: TurnDisplayPanel

  constructor() {
    super({ key: 'BattleScene' })
  }

  preload(): void {
    // Character frames load here via AnimationPlayer.preloadState once
    // setTurnState supplies the manifest. Currently a no-op stub.
  }

  create(): void {
    const { width, height } = this.scale
    this.bg       = this.add.rectangle(0, 0, width, height, BG_COLOUR).setOrigin(0, 0)
    this.vignette = this.add.graphics()
    this.drawVignette(width, height)

    const gfx = this.make.graphics({}, false)
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(4, 4, 4)
    gfx.generateTexture(PARTICLE_KEY, 8, 8)
    gfx.destroy()

    const particles         = new ParticleEmitter(this)
    const projectilePanel   = new ProjectilePanel(this)
    this.unitStage          = new UnitStage(this, TOP_INSET)
    this.dicePanel          = new DicePanel(this, TOP_INSET)
    this.sequenceRunner     = new SequenceRunner(this, this.unitStage, particles, projectilePanel)
    this.feedbackPanel      = new FeedbackPanel(this, TOP_INSET, this.unitStage)
    this.turnDisplayPanel   = new TurnDisplayPanel(this)
    void new ResolutionAdaptor(this)

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.bg.setSize(gameSize.width, gameSize.height)
      this.vignette.clear()
      this.drawVignette(gameSize.width, gameSize.height)
    })
  }

  // ── Stage 2: unit figures ─────────────────────────────────────────────────

  setTurnState(
    actingDefId:    string,
    targetDefId:    string,
    actingManifest: AnimationManifest | null = null,
    targetManifest: AnimationManifest | null = null,
    isDamaged:      { acting: boolean; target: boolean } = { acting: false, target: false },
  ): void {
    const show = () => this.unitStage.show(
      actingDefId, targetDefId, actingManifest, targetManifest, isDamaged,
    )

    if (this.unitStage.isVisible) {
      this.unitStage.hide(() => {
        this.time.delayedCall(BETWEEN_TURN_PAUSE_MS, show)
      })
    } else {
      show()
    }
  }

  clearTurn(): void {
    this.unitStage.hide()
  }

  /** True while a play-once animation (dash, death, hurt, dodge) is running on any figure. */
  isAnimating(): boolean {
    return this.unitStage.isAnimating()
  }

  // ── Stage 3: dice → attack → feedback (phase-gated via onDone) ───────────

  playDice(outcome: string, onDone: () => void): void {
    this.dicePanel.spin(outcome, onDone)
  }

  skipActiveDice(): void {
    this.dicePanel.skip()
  }

  playAttack(
    actingDefId: string,
    targetDefId: string,
    outcome:     string,
    damage:      number,
    isMelee:     boolean,
    dashDx:      number,
    projectile:  AnimationProjectileDef | null,
    onDone:      () => void,
  ): void {
    const diceOutcome = outcome as DiceOutcome
    const ctx: SequenceContext = {
      actingDefId, targetDefId,
      outcome:    diceOutcome,
      damage, isMelee, dashDx, projectile,
    }
    const phases = buildDefaultSequence(isMelee, diceOutcome)
    this.sequenceRunner.run(phases, ctx, onDone)
  }

  /** Skip the active attack sequence — cancels pending waits and fires onDone. */
  skipActiveAttack(): void {
    this.sequenceRunner.skip()
  }

  playFeedback(text: string, colour: string): void {
    this.feedbackPanel.show(text, colour)
  }

  // ── Stage 4: death collapse ───────────────────────────────────────────────

  playDeath(defId: string, onDone: () => void): void {
    this.unitStage.collapseByDefId(defId, onDone)
  }

  // ── Stage 5: turn display overlay ────────────────────────────────────────

  showTurnDisplay(data: TurnPanelData): void {
    this.turnDisplayPanel.show(data)
  }

  hideTurnDisplay(): void {
    this.turnDisplayPanel.hide()
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private drawVignette(w: number, h: number): void {
    const edge = Math.floor(h * 0.2)
    this.vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0)
    this.vignette.fillRect(0, 0, w, edge)
    this.vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.45, 0.45)
    this.vignette.fillRect(0, h - edge, w, edge)
  }
}
