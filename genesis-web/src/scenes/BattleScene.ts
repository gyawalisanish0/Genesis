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
import { UnitStage }        from './battle/UnitStage'
import { DicePanel }        from './battle/DicePanel'
import { AttackPanel }      from './battle/AttackPanel'
import { FeedbackPanel }    from './battle/FeedbackPanel'
import { ParticleEmitter, PARTICLE_KEY } from './battle/ParticleEmitter'
import { TurnDisplayPanel, TURN_PANEL_RESERVE } from './battle/TurnDisplayPanel'
import type { TurnPanelData } from './battle/TurnDisplayPanel'
import { BETWEEN_TURN_PAUSE_MS } from '../core/constants'

// Pixels at the top of the canvas permanently reserved for the TurnDisplayPanel.
// All other scene content (units, dice, feedback) is positioned below this.
const TOP_INSET = TURN_PANEL_RESERVE

// ── Design token colour map ───────────────────────────────────────────────────
// Mirrors src/styles/tokens.css so Phaser objects match the React UI exactly.

const TOKEN: Record<string, string> = {
  'var(--accent-genesis)': '#8b5cf6',
  'var(--accent-gold)':    '#f59e0b',
  'var(--accent-info)':    '#3b82f6',
  'var(--accent-heal)':    '#10b981',
  'var(--accent-warn)':    '#f97316',
  'var(--accent-danger)':  '#ef4444',
  'var(--accent-evasion)': '#06b6d4',
  'var(--text-primary)':   '#f1f0ff',
  'var(--text-secondary)': '#9b8ec4',
  'var(--text-muted)':     '#5c5480',
}

export function tokenToHex(colour: string): string {
  return TOKEN[colour] ?? colour
}

// ── BattleScene ───────────────────────────────────────────────────────────────

const BG_COLOUR = 0x0a0a14

export class BattleScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Rectangle

  private unitStage!:        UnitStage
  private dicePanel!:        DicePanel
  private attackPanel!:      AttackPanel
  private feedbackPanel!:    FeedbackPanel
  private turnDisplayPanel!: TurnDisplayPanel

  constructor() {
    super({ key: 'BattleScene' })
  }

  preload(): void {
    // Stage 4+: load character art → public/images/characters/{defId}/idle.png
    // this.load.image(defId, `images/characters/${defId}/idle.png`)
  }

  create(): void {
    const { width, height } = this.scale
    this.bg = this.add.rectangle(0, 0, width, height, BG_COLOUR).setOrigin(0, 0)

    // Generate a tiny white circle used as the particle texture.
    // Second arg false = don't add to the display list (destroy right after).
    const gfx = this.make.graphics({}, false)
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(4, 4, 4)
    gfx.generateTexture(PARTICLE_KEY, 8, 8)
    gfx.destroy()

    const particles       = new ParticleEmitter(this)
    this.unitStage        = new UnitStage(this, TOP_INSET)
    this.dicePanel        = new DicePanel(this, TOP_INSET)
    this.attackPanel      = new AttackPanel(this, this.unitStage, particles)
    this.feedbackPanel    = new FeedbackPanel(this, TOP_INSET)
    this.turnDisplayPanel = new TurnDisplayPanel(this)

    // gameSize carries the new canvas dimensions; subsequent params are stale values.
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.bg.setSize(gameSize.width, gameSize.height)
    })
  }

  // ── Stage 2: unit figures ─────────────────────────────────────────────────

  // If units are already on screen, hide them first then pause briefly so the
  // transition feels intentional before the incoming units slide in.
  setTurnState(actingDefId: string, targetDefId: string): void {
    if (this.unitStage.isVisible) {
      this.unitStage.hide(() => {
        this.time.delayedCall(BETWEEN_TURN_PAUSE_MS, () => {
          this.unitStage.show(actingDefId, targetDefId)
        })
      })
    } else {
      this.unitStage.show(actingDefId, targetDefId)
    }
  }

  clearTurn(): void {
    this.unitStage.hide()
  }

  // ── Stage 3: dice → attack → feedback (phase-gated via onDone) ───────────

  playDice(outcome: string, onDone: () => void): void {
    this.dicePanel.spin(outcome, onDone)
  }

  playAttack(
    casterId: string,
    targetId: string,
    outcome:  string,
    damage:   number,
    onDone:   () => void,
  ): void {
    this.attackPanel.play(casterId, targetId, outcome, damage, onDone)
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
}
