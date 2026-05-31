// ASCII animation data types — pure TS, no React/Phaser imports.
// Parallel to core/types.ts AnimationManifest but purpose-built for text rendering.

export interface AsciiManifest {
  type: 'ascii_manifest'
  defId: string
  frameSize: [number, number]
  palette: Record<string, string>      // paletteKey → CSS token e.g. '--accent-heal'
  actions: string[]
  skillActions: string[]
}

export interface AsciiProjectileDef {
  symbol: string
  path: 'straight' | 'arc' | 'burst'
  speedMs: number
  launchOnFrame: number
}

export interface AsciiStateConfig {
  frameMs: number
  loop: boolean
  breathPause?: number                 // idle frame 1 holds N×frameMs longer
  returnTo?: string                    // auto-transition when animation ends
  terminal?: boolean                   // no return (death)
  onFrame?: Record<string, string>     // "frameIndex" → event name (e.g. 'onImpact')
  projectile?: AsciiProjectileDef
  queuesOn?: string[]                  // queue if one of these states is playing
}

export interface AsciiSequence {
  type: 'ascii_sequence'
  defId: string
  states: Record<string, AsciiStateConfig>
  skillOverrides?: Record<string, AsciiStateConfig>
}

export interface AsciiActionFrames {
  type: 'ascii_action'
  defId: string
  action: string
  frames: string[][]                   // each frame: 32 strings × 32 chars
}

// ── Rendered frame data (engine → React) ────────────────────────────────────

export interface FigureAnimFrame {
  frame: string[]
  defId: string
  state: string
  flipped: boolean
}

export interface ProjectileFrame {
  symbol: string
  progressX: number                    // 0..1 acting→target
  progressY: number                    // arc offset 0..1..0
  visible: boolean
}

export interface AsciiArenaFrame {
  acting: FigureAnimFrame | null
  target: FigureAnimFrame | null
  projectile: ProjectileFrame | null
}

// ── Typed signal channel: engine → React (one-way, fire-and-forget) ──────────
//
// The engine fires signals; React subscribes and renders. No callbacks flow back.
// React handles its own display cleanup (auto-dismiss timers on burst/feedback).

import type { TurnDisplayData, TurnDisplayUnitData } from '../core/battle/EngineTypes'
export type { TurnDisplayData, TurnDisplayUnitData }

export type AnimSignal =
  | { type: 'frame';       frame: AsciiArenaFrame }
  | { type: 'dice';        outcome: string }
  | { type: 'dice_clear' }
  | { type: 'burst';       symbol: string; colour: string }
  | { type: 'feedback';    text: string;   colour: string }
  | { type: 'turn_show';   data: TurnDisplayData }
  | { type: 'turn_hide' }
