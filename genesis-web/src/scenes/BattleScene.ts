// BattleScene — Phaser 3 scene that owns the cinematic battle canvas.
//
// Stage 1 (this file): scrolling battle log display.
// Stage 2: acting unit + target appear as placeholder figures.
// Stage 3: dice spin → attack animation → feedback numbers (phase-gated).
// Stage 4: particles, screen shake, evasion slide, death collapse.
//
// React communicates via the public command methods below.
// Phaser communicates back to React via callbacks passed through SceneData.

import Phaser from 'phaser'

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

// ── Constants ─────────────────────────────────────────────────────────────────

const BG_COLOUR    = 0x0a0a14  // --bg-deep
const LINE_H       = 17        // px per log line
const LOG_PAD_X    = 10        // horizontal padding
const LOG_PAD_Y    = 8         // vertical padding
const MAX_ENTRIES  = 40        // entries kept in memory

const LOG_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"system-ui", "-apple-system", "sans-serif"',
  fontSize:   '11px',
  color:      '#f1f0ff',
  lineSpacing: 2,
  wordWrap:   { width: 0, useAdvancedWrap: true },
}

// ── Scene data passed from React ──────────────────────────────────────────────

export interface BattleSceneCallbacks {
  // Stage 3: called when dice animation finishes — React applies damage.
  onDiceAnimationDone?: () => void
  // Stage 3: called when attack animation finishes — React advances phase.
  onAttackAnimationDone?: () => void
}

// ── BattleScene ───────────────────────────────────────────────────────────────

export class BattleScene extends Phaser.Scene {
  private bg!:          Phaser.GameObjects.Rectangle
  private logGroup!:    Phaser.GameObjects.Group
  private logEntries:   Array<{ text: string; colour: string }> = []

  constructor() {
    super({ key: 'BattleScene' })
  }

  preload(): void {
    // Stage 2+: load character art here — public/images/characters/{defId}/idle.png
  }

  create(): void {
    const { width, height } = this.scale

    this.bg = this.add.rectangle(0, 0, width, height, BG_COLOUR).setOrigin(0, 0)
    this.logGroup = this.add.group()

    this.drawAccentLine(height)

    // Re-render log and reposition elements when canvas is resized.
    this.scale.on('resize', (_gs: Phaser.Structs.Size, _ds: Phaser.Structs.Size, _dw: number, _dh: number, newWidth: number, newHeight: number) => {
      this.onResize(newWidth, newHeight)
    })
  }

  // ── Stage 1: battle log ───────────────────────────────────────────────────

  addLogEntry(text: string, colour: string): void {
    this.logEntries.push({ text, colour })
    if (this.logEntries.length > MAX_ENTRIES) this.logEntries.shift()
    this.renderLog()
  }

  private renderLog(): void {
    this.logGroup.clear(true, true)

    const { width, height } = this.scale
    const maxVisible  = Math.floor((height - LOG_PAD_Y * 2) / LINE_H)
    const visible     = this.logEntries.slice(-maxVisible)
    const wrapWidth   = width - LOG_PAD_X * 2 - 6  // 6px for left accent line

    visible.forEach((entry, i) => {
      const y = height - LOG_PAD_Y - (visible.length - i) * LINE_H
      const t = this.add.text(LOG_PAD_X + 6, y, entry.text, {
        ...LOG_STYLE,
        color:    tokenToHex(entry.colour),
        wordWrap: { width: wrapWidth, useAdvancedWrap: true },
      })
      this.logGroup.add(t)
    })
  }

  private drawAccentLine(height: number): void {
    const line = this.add.graphics()
    line.fillStyle(0x8b5cf6, 0.25)  // --accent-genesis faint
    line.fillRect(LOG_PAD_X, LOG_PAD_Y, 2, height - LOG_PAD_Y * 2)
  }

  // ── Stage 2 stubs — unit figures ──────────────────────────────────────────
  // Replace stub bodies with real implementation in Stage 2.

  setTurnState(_actingDefId: string, _targetDefId: string): void {}
  clearTurn(): void {}

  // ── Stage 3 stubs — dice + attack + feedback ──────────────────────────────
  // Stubs immediately invoke callbacks so the battle flow is unaffected.

  playDice(_outcome: string, onDone: () => void): void {
    onDone()
  }

  playAttack(
    _casterId: string,
    _targetId: string,
    _outcome:  string,
    _damage:   number,
    onDone:    () => void,
  ): void {
    onDone()
  }

  playFeedback(_text: string, _colour: string): void {}

  // ── Internal ──────────────────────────────────────────────────────────────

  private onResize(newWidth: number, newHeight: number): void {
    this.bg.setSize(newWidth, newHeight)
    this.renderLog()
  }
}
