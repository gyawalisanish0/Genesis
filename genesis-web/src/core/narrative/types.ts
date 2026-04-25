// Pure types for the narrative layer — no React, no UI imports.

// ── Trigger condition ─────────────────────────────────────────────────────────

export interface NarrativeTrigger {
  event?:    string  // matches NarrativeEvent.type exactly
  actorId?:  string  // CharacterDef.id — matches only when event.actorId === this
  targetId?: string  // CharacterDef.id — matches only when event.targetId === this
  chance?:   number  // 0–1 roll gate; default 1.0 (always fires)
}

// ── Animation types ───────────────────────────────────────────────────────────
// Each entry carries an `animations` array listing which visual effects to play.
// Multiple animations run simultaneously when the entry triggers.

export type NarrativeAnimation =
  | { type: 'dialogue' }
  | { type: 'screen_flash'; colour: string; duration?: number }
  | { type: 'portrait_fly'; speakerId: string; side?: 'left' | 'right'; duration?: number }
  | { type: 'floating_text'; text: string; colour?: string }

// ── Entry — the atomic narrative unit ────────────────────────────────────────

export interface DialogueLine {
  speakerId: string  // CharacterDef.id — who speaks this line
  text:      string
}

export interface NarrativeEntry {
  narrativeId: string            // unique primary key across all loaded namespaces
  trigger?:    NarrativeTrigger  // absent = reachable only via NarrativeService.play()
  once?:       boolean           // true → show at most once per session
  sequence?:   boolean           // true → all lines in order; false/absent → one picked randomly
  blocking?:   boolean           // true → dims screen and blocks input while showing
  priority?:   number            // higher interrupts lower; default 0
  animations:  NarrativeAnimation[]
  lines?:      DialogueLine[]    // required when animations includes { type: 'dialogue' }
}

// ── File-level containers ─────────────────────────────────────────────────────

export interface CharacterDialogueDef {
  type:    'dialogue'
  defId:   string  // matches CharacterDef.id
  entries: NarrativeEntry[]
}

export interface LevelNarrativeDef {
  type:    'narrative'
  levelId: string
  entries: NarrativeEntry[]
}

// ── Runtime event ─────────────────────────────────────────────────────────────

export interface NarrativeEvent {
  type:      string                    // e.g. 'battle_start' | 'skill_used' | 'unit_death'
  actorId?:  string                    // CharacterDef.id of the acting unit
  targetId?: string                    // CharacterDef.id of the target unit
  payload?:  Record<string, unknown>   // open for custom triggers
}
