# Narrative Layer

The narrative layer brings characters to life through event-driven dialogue and
animations. It is globally active — any screen or context can fire a
`NarrativeEvent` and the nearest `NarrativeLayer` component resolves and
renders the matching visual.

---

## Architecture Overview

```
JSON files (characters/{id}/dialogue.json, levels/{id}/narrative.json)
  ↓  loaded at startup by SplashScreen
NarrativeService.registerEntries(namespace, entries)
  ↓
NarrativeService.emit(event) or NarrativeService.play(narrativeId)
  ↓
NarrativeLayer (mounted globally in App.tsx)
  → resolveByEvent / resolveById
  → renders animations: dialogue box, screen flash, portrait fly-in, floating text
```

---

## JSON Scopes

### Character dialogue — `public/data/characters/{id}/dialogue.json`

Universal reactions that apply regardless of mode or level. Loaded at startup
for all characters in the index. Registered under namespace `'characters'`.

```json
{
  "type":   "dialogue",
  "defId":  "warrior_001",
  "entries": [ ... ]
}
```

### Level narrative — `public/data/levels/{levelId}/narrative.json`

Story-specific beats scoped to a single level or encounter. Loaded at startup
for known levels. Registered under namespace `'{levelId}'`.

```json
{
  "type":    "narrative",
  "levelId": "story_001",
  "entries": [ ... ]
}
```

Future levels add a new file — no code changes required.

---

## NarrativeEntry Fields

| Field         | Type                    | Default | Description |
|---|---|---|---|
| `narrativeId` | `string`               | —       | Unique primary key across all namespaces |
| `trigger`     | `NarrativeTrigger`     | absent  | Absent = direct-play only |
| `once`        | `boolean`              | false   | Show at most once per session |
| `sequence`    | `boolean`              | false   | `true` = all lines in order; `false` = one random |
| `blocking`    | `boolean`              | false   | Dims screen and blocks underlying input |
| `priority`    | `number`               | 0       | Higher interrupts lower-priority active entry |
| `animations`  | `NarrativeAnimation[]` | —       | Visual effects to play simultaneously |
| `lines`       | `DialogueLine[]`       | absent  | Required when `animations` includes `dialogue` |

### NarrativeTrigger Fields

| Field      | Description |
|---|---|
| `event`    | Must match `NarrativeEvent.type` exactly |
| `actorId`  | Must match `NarrativeEvent.actorId` when present |
| `targetId` | Must match `NarrativeEvent.targetId` when present |
| `chance`   | `0`–`1` roll gate; default `1.0` (always fires) |

---

## Animation Types

```ts
type NarrativeAnimation =
  | { type: 'dialogue' }
  | { type: 'screen_flash'; colour: string; duration?: number }
  | { type: 'portrait_fly'; speakerId: string; side?: 'left' | 'right'; duration?: number }
  | { type: 'floating_text'; text: string; colour?: string }
```

All animations in an entry's `animations` array play simultaneously. The entry
is dismissed once every animation reports completion.

| Type            | Component                    | Duration source |
|---|---|---|
| `dialogue`      | `NarrativeDialogueOverlay`   | Auto-dismiss after `NARRATIVE_DISMISS_MS` (3.5s), or tap |
| `screen_flash`  | `NarrativeScreenFlash`       | `duration` field (default `NARRATIVE_FLASH_MS` = 600ms) |
| `portrait_fly`  | `NarrativePortraitFlyIn`     | `duration` field (default `NARRATIVE_FLY_MS` = 350ms) |
| `floating_text` | `NarrativeFloatingText`      | `NARRATIVE_FLOAT_MS` = 1200ms |

---

## Battle Freeze

Any entry whose `animations` array contains `{ type: 'dialogue' }` silently
freezes the battle for the duration of the dialogue:

| System | Behaviour while frozen |
|---|---|
| Enemy AI timers | Cancelled; restart fresh after dismiss |
| Player `executeSkill` | Blocked — ROLL button does nothing |
| Player `skipTurn` | Blocked |
| Phase derivation | Deferred — no clash / QTE prompt fires mid-dialogue |

- Freeze is **silent** — no badge, no overlay; the dialogue box is the only indicator
- Resume is **instant** — the battle clock resumes the moment the box dismisses
- `narrativePaused` in `BattleContext` is independent of `isPaused` (back-button pause menu); both can be true simultaneously

Non-dialogue animations (`screen_flash`, `portrait_fly`, `floating_text`) do
**not** freeze the battle — they play over live action.

---

## NarrativeService API

```ts
import { NarrativeService } from './services/NarrativeService'

// Fire an event — NarrativeLayer resolves matching entries.
NarrativeService.emit({ type: 'battle_start', actorId: 'warrior_001' })

// Directly trigger a known entry by ID — bypasses event matching.
NarrativeService.play('warrior_001_clash_win')

// Register / unregister entry sets by namespace.
NarrativeService.registerEntries('characters', entries)
NarrativeService.unregisterEntries('level')

// Subscribe to events (used internally by NarrativeLayer).
const unsub = NarrativeService.subscribe((event) => { ... })
unsub()  // cleanup

// Subscribe to direct plays (used internally by NarrativeLayer).
const unsub = NarrativeService.subscribeDirect((id) => { ... })
unsub()
```

---

## Standard Event Type Strings

| String             | When emitted |
|---|---|
| `'battle_start'`   | Battle initialises; actorId = player defId, targetId = first enemy defId |
| `'battle_victory'` | All enemies defeated |
| `'battle_defeat'`  | Player unit HP reaches 0 |
| `'skill_used'`     | Skill fires after dice resolves; actorId = caster defId |
| `'boosted_hit'`    | Dice outcome is `Boosted`; actorId = caster defId |
| `'evaded'`         | Dice outcome is `Evade`; actorId = evader defId |
| `'unit_death'`     | Any unit HP reaches 0; actorId = dead unit defId |
| `'counter'`        | Counter roll succeeds; actorId = defender defId |
| `'clash_resolved'` | Clash winner determined; actorId = winning unit defId |

Any string is valid. Future events (`'level_enter'`, `'boss_phase_change'`)
require no code changes — add entries to the relevant JSON files.

---

## Unit Registry

Portrait fly-in components need to look up a unit's rarity and name from its
`defId`. Register active battle units via:

```ts
import { NarrativeUnits } from './components/NarrativeLayer'

NarrativeUnits.register([player, ...enemies])  // call after units load
NarrativeUnits.clear()                          // call on battle unmount
```

---

## Priority & Blocking

- **Priority**: higher-priority entries interrupt currently active lower-priority
  ones. Same-priority events replace each other (last wins).
- **Blocking** (`blocking: true`): the `NarrativeLayer` renders a dim backdrop
  and captures all pointer events until the entry is dismissed. Use for story
  cutscenes. Do not use for frequent reactive dialogue.

---

## Examples

### Random battle cry (60% chance, portrait fly-in + dialogue)

```json
{
  "narrativeId": "warrior_001_skill_used",
  "trigger": { "event": "skill_used", "actorId": "warrior_001", "chance": 0.6 },
  "animations": [
    { "type": "portrait_fly", "speakerId": "warrior_001", "side": "left" },
    { "type": "dialogue" }
  ],
  "lines": [
    { "speakerId": "warrior_001", "text": "Iron and will!" },
    { "speakerId": "warrior_001", "text": "You won't stop me." }
  ]
}
```

### Sequential story cutscene (blocking, plays once)

```json
{
  "narrativeId": "story_001_intro",
  "trigger": { "event": "battle_start" },
  "once": true, "sequence": true, "blocking": true, "priority": 20,
  "animations": [{ "type": "dialogue" }],
  "lines": [
    { "speakerId": "warrior_001", "text": "This outpost shouldn't be this quiet." },
    { "speakerId": "hunter_001",  "text": "Something's coming. I can hear it." },
    { "speakerId": "warrior_001", "text": "Then we meet it head on." }
  ]
}
```

### Floating impact callout with screen flash

```json
{
  "narrativeId": "warrior_001_boosted_hit",
  "trigger": { "event": "boosted_hit", "actorId": "warrior_001", "chance": 0.7 },
  "animations": [
    { "type": "floating_text", "text": "CRUSHING BLOW!", "colour": "var(--accent-gold)" },
    { "type": "screen_flash",  "colour": "var(--accent-gold)", "duration": 400 }
  ]
}
```

### Direct play from code

```ts
// Fire on boss phase change — no event trigger needed in the JSON.
NarrativeService.play('boss_phase_2_taunt')
```
