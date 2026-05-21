// FigureAnimator — per-unit ASCII animation state machine.
// Driven by AsciiAnimEngine.update(dt); no rAF calls of its own.

import type { AsciiManifest, AsciiSequence, AsciiStateConfig, AsciiActionFrames } from './types'

// ── Default configs (used when no sequence JSON is present) ─────────────────

const DEFAULT_CONFIGS: Record<string, AsciiStateConfig> = {
  idle:   { frameMs: 600, loop: true,  breathPause: 3 },
  attack: { frameMs: 100, loop: false, returnTo: 'idle', onFrame: { '1': 'onImpact' } },
  hurt:   { frameMs: 80,  loop: false, returnTo: 'idle', queuesOn: ['attack'] },
  dodge:  { frameMs: 90,  loop: false, returnTo: 'idle' },
  death:  { frameMs: 180, loop: false, terminal: true },
}

// ── Generic fallback figure (32×32 grid) ────────────────────────────────────

const E = '                                '  // 32 spaces
const GENERIC_IDLE: string[][] = [
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '               ◈                ',
    '              ╱║╲               ',
    '               ║                ',
    '              ╱ ╲               ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '              ·◈·               ',
    '              ╱║╲               ',
    '               ║                ',
    '              ╱ ╲               ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
]

const GENERIC_ATTACK: string[][] = [
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '               ◈                ',
    '             ═╪═╗               ',
    '             ╠ ║╗╣              ',
    '            ╱╚═╦╝               ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '               ◈                ',
    '             ═╪═╪═══⚔           ',
    '             ╠ ║                ',
    '            ╱╚═╦═╝╲             ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '              ·◈·               ',
    '             ═╪═╪═              ',
    '             ╠·║·╣              ',
    '            ╱╚═╦═╝╲             ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
]

const GENERIC_HURT: string[][] = [
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '               ◈                ',
    '            ·═╪═╪═·             ',
    '             ╠!║!╣              ',
    '            ╲╚═╦═╝              ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '              ·◈·               ',
    '             ═╪═╪═              ',
    '             ╠ ║ ╣              ',
    '            ╱╚═╦═╝╲             ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
]

const GENERIC_DEATH: string[][] = [
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '               ◈                ',
    '             ═╪═╪═              ',
    '             ╠ ║ ╣╲             ',
    '            ╱╚═╦═╝              ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '              ◈·                ',
    '            ·═╪═·               ',
    '             ╠ ║╲               ',
    '            ╱╚═╦·               ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '             ·◈·                ',
    '              ·═·               ',
    '              ·║·               ',
    '              ╦·                ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
  [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '             · · ·              ',
    '             · ◈ ·              ',
    '             · · ·              ',
    E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E,
  ],
]

const GENERIC_FRAMES: Record<string, string[][]> = {
  idle: GENERIC_IDLE, attack: GENERIC_ATTACK,
  hurt: GENERIC_HURT, death: GENERIC_DEATH,
  dodge: GENERIC_HURT,  // reuse hurt for generic dodge
}

// ── FigureAnimator ───────────────────────────────────────────────────────────

export class FigureAnimator {
  private sequence: AsciiSequence | null = null
  private framesCache = new Map<string, string[][]>()

  private state = 'idle'
  private currentSkillId: string | undefined
  private frameIndex = 0
  private elapsed = 0
  private pendingState: string | null = null
  private isTerminal = false
  private onImpactCallback: (() => void) | null = null

  setSequence(seq: AsciiSequence): void {
    this.sequence = seq
  }

  setActionFrames(action: string, data: AsciiActionFrames): void {
    this.framesCache.set(action, data.frames)
  }

  playAttack(skillId?: string, onImpact?: () => void): void {
    this.currentSkillId = skillId
    this.onImpactCallback = onImpact ?? null
    this.transition('attack')
  }

  playHurt(): void {
    const config = this.resolveConfig(this.state)
    const queuesOn = config.queuesOn ?? []
    if (queuesOn.includes(this.state)) {
      this.pendingState = 'hurt'
    } else {
      this.transition('hurt')
    }
  }

  playDodge(): void {
    this.transition('dodge')
  }

  playDeath(): void {
    this.isTerminal = false
    this.transition('death')
  }

  reset(): void {
    this.transition('idle')
    this.pendingState = null
    this.isTerminal = false
    this.onImpactCallback = null
  }

  // Returns true if frame index changed.
  update(dt: number): boolean {
    if (this.isTerminal) return false

    const config = this.resolveConfig(this.state, this.currentSkillId)
    const frames = this.framesFor(this.state, this.currentSkillId)
    if (!frames.length) return false

    this.elapsed += dt

    const isBreath = this.state === 'idle' && this.frameIndex === 1 && !!config.breathPause
    const holdMs = isBreath ? config.breathPause! * config.frameMs : 0
    if (this.elapsed < config.frameMs + holdMs) return false
    this.elapsed -= config.frameMs + holdMs

    const next = this.frameIndex + 1
    if (next < frames.length) {
      this.frameIndex = next
      this.fireFrameEvents(config, next)
      return true
    }

    // End of animation
    if (config.terminal) {
      this.isTerminal = true
      return true
    }

    const returnTo = this.pendingState ?? config.returnTo
    this.pendingState = null
    this.transition(returnTo ?? 'idle')
    return true
  }

  getCurrentFrame(): string[] {
    const frames = this.framesFor(this.state, this.currentSkillId)
    const frame  = frames[this.frameIndex] ?? GENERIC_IDLE[0]
    return FigureAnimator.padToHeight(frame)
  }

  // Feet-anchor: pad empty rows at the top so all frames share a common
  // ground line regardless of how many rows each character's art uses.
  private static readonly TARGET_HEIGHT = 16
  private static readonly EMPTY_ROW     = ' '.repeat(32)

  private static padToHeight(frame: string[]): string[] {
    if (frame.length >= FigureAnimator.TARGET_HEIGHT) return frame
    const pad = Array(FigureAnimator.TARGET_HEIGHT - frame.length).fill(FigureAnimator.EMPTY_ROW)
    return [...pad, ...frame]
  }

  getCurrentState(): string {
    return this.state
  }

  private transition(state: string): void {
    this.state = state
    this.currentSkillId = state === 'attack' ? this.currentSkillId : undefined
    this.frameIndex = 0
    this.elapsed = 0
  }

  private resolveConfig(state: string, skillId?: string): AsciiStateConfig {
    if (skillId && this.sequence?.skillOverrides?.[skillId]) {
      return this.sequence.skillOverrides[skillId]
    }
    return this.sequence?.states[state] ?? DEFAULT_CONFIGS[state] ?? DEFAULT_CONFIGS.idle
  }

  private framesFor(state: string, skillId?: string): string[][] {
    const key = (state === 'attack' && skillId) ? skillId : state
    return this.framesCache.get(key) ?? GENERIC_FRAMES[state] ?? GENERIC_IDLE
  }

  private fireFrameEvents(config: AsciiStateConfig, frameIdx: number): void {
    const evt = config.onFrame?.[String(frameIdx)]
    if (evt === 'onImpact' && this.onImpactCallback) {
      this.onImpactCallback()
      this.onImpactCallback = null
    }
  }
}
