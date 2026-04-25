// BattleScene — Phaser 3 scene that owns the cinematic battle canvas.
//
// Stage 1: scrolling battle log.
// Stage 2: acting unit + target placeholder figures (UnitStage).
// Stage 3: dice spin → attack animation → feedback numbers (phase-gated via onDone).
// Stage 4: screen shake, particle bursts, evasion dodge, death collapse.
//
// React communicates via the public command methods; Phaser communicates back
// to React via the onDone callbacks passed into playDice / playAttack / playDeath.

import Phaser from 'phaser'
import { UnitStage }        from './battle/UnitStage'
import { DicePanel }        from './battle/DicePanel'
import { AttackPanel }      from './battle/AttackPanel'
import { FeedbackPanel }    from './battle/FeedbackPanel'
import { ParticleEmitter, PARTICLE_KEY } from './battle/ParticleEmitter'

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

// ── Log layout constants ──────────────────────────────────────────────────────

const BG_COLOUR      = 0x0a0a14
const LINE_H         = 17
const LOG_PAD_X      = 10
const LOG_PAD_Y      = 8
const MAX_ENTRIES    = 40
const LOG_UNIT_SPLIT = 0.58   // log compressed to lower 42% when units visible

const LOG_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"system-ui", "-apple-system", "sans-serif"',
  fontSize:   '11px',
  color:      '#f1f0ff',
  lineSpacing: 2,
  wordWrap:   { width: 0, useAdvancedWrap: true },
}

// ── BattleScene ───────────────────────────────────────────────────────────────

export class BattleScene extends Phaser.Scene {
  private bg!:           Phaser.GameObjects.Rectangle
  private logGroup!:     Phaser.GameObjects.Group
  private logEntries:    Array<{ text: string; colour: string }> = []

  private unitStage!:     UnitStage
  private dicePanel!:     DicePanel
  private attackPanel!:   AttackPanel
  private feedbackPanel!: FeedbackPanel

  constructor() {
    super({ key: 'BattleScene' })
  }

  preload(): void {
    // Stage 4+: load character art → public/images/characters/{defId}/idle.png
    // this.load.image(defId, `images/characters/${defId}/idle.png`)
  }

  create(): void {
    const { width, height } = this.scale
    this.bg       = this.add.rectangle(0, 0, width, height, BG_COLOUR).setOrigin(0, 0)
    this.logGroup = this.add.group()

    // Generate a tiny white circle used as the particle texture.
    // Second arg false = don't add to the display list (destroy right after).
    const gfx = this.make.graphics({}, false)
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(4, 4, 4)
    gfx.generateTexture(PARTICLE_KEY, 8, 8)
    gfx.destroy()

    const particles   = new ParticleEmitter(this)
    this.unitStage    = new UnitStage(this)
    this.dicePanel    = new DicePanel(this)
    this.attackPanel  = new AttackPanel(this, this.unitStage, particles)
    this.feedbackPanel = new FeedbackPanel(this)

    this.drawAccentLine(height)

    this.scale.on('resize', (
      _gs: Phaser.Structs.Size, _ds: Phaser.Structs.Size,
      _dw: number, _dh: number,
      newW: number, newH: number,
    ) => this.onResize(newW, newH))
  }

  // ── Stage 1: battle log ───────────────────────────────────────────────────

  addLogEntry(text: string, colour: string): void {
    this.logEntries.push({ text, colour })
    if (this.logEntries.length > MAX_ENTRIES) this.logEntries.shift()
    this.renderLog()
  }

  // ── Stage 2: unit figures ─────────────────────────────────────────────────

  setTurnState(actingDefId: string, targetDefId: string): void {
    this.unitStage.show(actingDefId, targetDefId)
    this.renderLog()
  }

  clearTurn(): void {
    this.unitStage.hide(() => this.renderLog())
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

  // ── Private helpers ───────────────────────────────────────────────────────

  private renderLog(): void {
    this.logGroup.clear(true, true)
    const { width, height } = this.scale
    const logTop  = this.unitStage.isVisible ? Math.floor(height * LOG_UNIT_SPLIT) : 0
    const availH  = height - logTop - LOG_PAD_Y * 2
    const maxVis  = Math.max(1, Math.floor(availH / LINE_H))
    const visible = this.logEntries.slice(-maxVis)
    const wrapW   = width - LOG_PAD_X * 2 - 6

    visible.forEach((entry, i) => {
      const y = height - LOG_PAD_Y - (visible.length - i) * LINE_H
      if (y < logTop) return
      const t = this.add.text(LOG_PAD_X + 6, y, entry.text, {
        ...LOG_STYLE,
        color:    tokenToHex(entry.colour),
        wordWrap: { width: wrapW, useAdvancedWrap: true },
      })
      this.logGroup.add(t)
    })
  }

  private drawAccentLine(height: number): void {
    const g = this.add.graphics()
    g.fillStyle(0x8b5cf6, 0.25)
    g.fillRect(LOG_PAD_X, LOG_PAD_Y, 2, height - LOG_PAD_Y * 2)
  }

  private onResize(newWidth: number, newHeight: number): void {
    this.bg.setSize(newWidth, newHeight)
    this.renderLog()
  }
}
