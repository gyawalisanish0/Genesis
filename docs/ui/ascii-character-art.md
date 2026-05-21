# ASCII Character Art — Frame-by-Frame Animation Spec

> **The ASCII art is diegetic.** It is not a style choice — it is the
> Commander's perception of reality. The Commander is an OMEGA-tier
> consciousness. Higher consciousness perceives lower consciousness in
> simplified form, the way a human perceives an ant: pattern, structure,
> signal — not full resolution. The battle is real. The characters are
> real. The Commander sees them as Unicode symbol structures because that
> is what OMEGA perception does to lower-order reality.
>
> Full lore: `docs/lore/perception-tiers.md`

Characters are drawn in a **32 × 32 grid** of Unicode symbols. Color derives
from Unicode block membership — the art itself carries its color identity,
no markup required. Motion (translate, scale, rotate) is CSS layered on top
of the grid; the grid itself never moves.

---

## File Structure

Each character that has ASCII animation gets an `animations/` subfolder:

```
public/data/characters/{id}/
  main.json
  skills.json
  passive.json
  dialogue.json
  animations/                       ← absent = generic fallback, no error
    animations.json                 ← manifest: palette, frameSize, action list
    anim_sequence.json              ← flow control: timing, state machine, transitions
    idle_anim.json                  ← idle frames  (32×32 arrays)
    attack_anim.json                ← base attack frames
    hurt_anim.json
    death_anim.json
    dodge_anim.json
    {skill_id}_anim.json            ← one per skill with a custom animation
```

`animations/animations.json` is the gatekeeper. If it is absent, `DataService`
returns `null` and the engine uses the generic figure — no further fetches
are attempted.

---

## DataService Loading Chain

```
loadAsciiManifest(defId)          → animations/animations.json     (null if absent)
loadAsciiSequence(defId)          → animations/anim_sequence.json  (null if absent)
loadAsciiAction(defId, action)    → animations/{action}_anim.json  (lazy, on demand)
```

`loadAsciiManifest` and `loadAsciiSequence` load during `BattleContext` startup
alongside `animations.json` in the existing `Promise.all`. Action files load
lazily — `idle_anim.json` on turn start, `attack_anim.json` on first attack,
`{skill_id}_anim.json` when that skill first executes.

---

## 32 × 32 Grid

Each frame is an array of 32 strings, each string exactly 32 characters wide.
Art is centred within the grid; unused rows and columns are spaces.

```jsonc
// example: rows 0–31, columns 0–31
[
  "                                ",   // row 0  — empty
  "                                ",   // row 1  — empty
  "               ◈                ",   // row 2  — head centred at col 15
  "             ═╪═╪═              ",   // row 3  — shoulders
  "             ╠·║·╣              ",   // row 4  — chest
  "            ╱╚═╦═╝╲             ",   // row 5  — torso
  "              ║   ║             ",   // row 6  — waist
  "            ═╧═ ═╧═             ",   // row 7  — feet
  "              ·   ·             ",   // row 8  — nanite particles
  "                                ",   // rows 9–31 — empty
  ...
]
```

**Full frames only** — each frame stores all 32 rows. Delta compression is
deferred until file size is measurably a problem.

---

## Color System — Unicode Block Classification

Color comes from the character drawn, not from markup. The renderer classifies
each glyph by its Unicode block and resolves the color from the character's
palette.

### Unicode block → palette key

| Unicode range  | Example chars           | Palette key  |
|----------------|-------------------------|--------------|
| U+2500–U+257F  | `═ ║ ╠ ╣ ╚ ╝ ╦ ╪ ╱ ╲`  | `box`        |
| U+2580–U+259F  | `█ ▓ ▄ ▌ ▐ ░`           | `block`      |
| U+25A0–U+25FF  | `◈ ◉ ⬡ ▪ ◆ ✦`           | `identity`   |
| U+2600–U+26FF  | `⚔ ⚡ ★ ✕`               | `weapon`     |
| Particle set   | `· ∿ ~ ≋`               | `particle`   |
| Impact set     | `!`                     | `impact`     |
| Space / Latin  | ` ` letters digits      | `base`       |

`identity` resolves to `--rarity-N` using the character's `rarity` field.
`base` characters inherit the default text color — no span emitted.

### Same frame, different character through palette alone

```
Hugo      box → --text-secondary     cold machined steel
Husty     box → --accent-evasion     psychic cyan lattice
Grunt     box → --text-muted         dim organic mass
Kiragen   box → --accent-info        alien blue composite
```

---

## `animations.json` — Manifest

```jsonc
{
  "type": "ascii_manifest",
  "defId": "hugo_001",
  "frameSize": [32, 32],
  "palette": {
    "box":      "--text-secondary",
    "block":    "--text-secondary",
    "identity": "rarity",
    "weapon":   "--accent-heal",
    "particle": "--text-muted",
    "impact":   "--accent-danger",
    "base":     "--text-primary"
  },
  "actions": ["idle", "attack", "hurt", "death", "dodge"],
  "skillActions": ["hugo_001_hammer_bash", "hugo_001_hyper_sense"]
}
```

---

## `anim_sequence.json` — Flow Control

```jsonc
{
  "type": "ascii_sequence",
  "defId": "hugo_001",
  "states": {
    "idle": {
      "frameMs":     600,
      "loop":        true,
      "breathPause": 3
    },
    "attack": {
      "frameMs":     100,
      "loop":        false,
      "returnTo":    "idle",
      "onFrame":     { "2": "onImpact" },
      "projectile": {
        "symbol":        "⚔",
        "path":          "straight",
        "speedMs":       280,
        "launchOnFrame": 2
      }
    },
    "hurt": {
      "frameMs":  80,
      "loop":     false,
      "returnTo": "idle",
      "queuesOn": ["attack"]
    },
    "death": {
      "frameMs":  180,
      "loop":     false,
      "terminal": true
    },
    "dodge": {
      "frameMs":  90,
      "loop":     false,
      "returnTo": "idle"
    }
  },
  "skillOverrides": {
    "hugo_001_hammer_bash": {
      "frameMs":  120,
      "loop":     false,
      "returnTo": "idle",
      "onFrame":  { "2": "onImpact" },
      "projectile": {
        "symbol":        "▓",
        "path":          "straight",
        "speedMs":       200,
        "launchOnFrame": 2
      }
    },
    "hugo_001_hyper_sense": {
      "frameMs":  80,
      "loop":     false,
      "returnTo": "idle"
    }
  }
}
```

**State machine rules (enforced by `FigureAnimator`):**

```
idle ←─────────────────────────────┐
  ├─ playAttack(skillId) → attack ─┘  auto-return to idle
  ├─ playHurt()          → hurt   ─┘  queues if attack playing
  ├─ playDodge()         → dodge  ─┘  auto-return to idle
  └─ playDeath()         → death     terminal — no return
```

---

## `{action}_anim.json` — Frame Data

```jsonc
{
  "type": "ascii_action",
  "defId": "hugo_001",
  "action": "attack",
  "frames": [
    [
      "                                ",
      "               ◈               ",
      "             ═╪═╗              ",
      "             ╠ ║╗╣             ",
      "            ╱╚═╦╝              ",
      "              ║   ║            ",
      "            ═╧═ ═╧═            ",
      ...
    ],
    [
      "                                ",
      "               ◈               ",
      "             ═╪═╪═══⚔          ",
      "             ╠ ║               ",
      "            ╱╚═╦═╝╲            ",
      "              ╱   ╲            ",
      "                               ",
      ...
    ],
    [
      "                                ",
      "              ·◈·              ",
      "             ═╪═╪═             ",
      "             ╠·║·╣             ",
      "            ╱╚═╦═╝╲            ",
      "              ║   ║            ",
      "            ═╧═ ═╧═            ",
      ...
    ]
  ]
}
```

---

## Character Art Reference

Art is defined in the `{action}_anim.json` files. The designs below are the
canonical reference used when authoring those files.

### Hugo Rekrot — ANBOT Nanite Warrior (Rarity 4 · `◈`)

**Design rule: ANBOT is hidden.** Hugo wears a tactical outfit. ANBOT is a thin
nanite layer underneath it — an undergarment, not surface armour. The ASCII reads
as a lean tactical operator: box-drawing lines form vest structure and gear rack,
no block fills. The nanite layer is invisible except at two points:

- `·` at the chest collar row — nanites running under the fabric, just visible at the seam
- `·═══·` on the attack impact row — nanites briefly surfacing at the strike point, then retracting

Skills extend outward from the hidden base: blade (`⚔`) for Nanites Slash, hammer
mass for Hammer Bash. Death leaves only the crown gem (`◈`) and dispersing `·`
particles — ANBOT offline with the suit.

```
IDLE                          IDLE (breath — crown shifts)
   ·◆◈◆·                        ·◆◈◆·
  ╔══╧══╗                       ╔══╧══╗
  ║◉   ◉║                       ║◉   ◉║
  ╚══╤══╝                       ╚══╤══╝
 ╔═╪═══╪═╗                     ╔═╪═══╪═╗
 ║ ║·  ║ ║     ← ANBOT hint    ║ ║·  ║ ║
 ╠═╪═══╪═╣                     ╠═╪═══╪═╣
 ║ ║   ║ ║                     ║ ║   ║ ║
═╬═╝   ╚═╬═                   ═╬═╝   ╚═╬═
   ║     ║                        ║     ║
  ═╩═   ═╩═                     ═╩═   ═╩═

ATTACK (windup)   ATTACK (impact)        ATTACK (followthrough)
   ·◆◈◆·             ·◆◈◆·                  ·◆◈◆·
  ╔══╧══╗            ╔══╧══╗                ╔══╧══╗
  ║◉   ◉║            ║◉   ◉║                ║◉   ◉║
  ╚══╤══╝            ╚══╤══╝                ╚══╤══╝
 ╔═╪═══╪═╗          ╔═╪═══╪═╗·═══·         ╔═╪═══╪═╗═·
 ║ ║·  ║ ║          ║ ║·  ╠══·             ║ ║·  ╠═
 ╠═╪═══╪═╣          ╠═╪═══╪═╣              ╠═╪═══╪═╣
 ║ ║   ║ ║          ║ ║   ║ ║              ║ ║   ║ ║
═╬═╝   ╚═╬═        ═╬═╝   ╚═╬═            ═╬═╝   ╚═╬═
   ║     ║             ║     ║               ║     ║
  ═╩═   ═╩═           ═╩═   ═╩═             ═╩═   ═╩═

HURT (recoil — body left, ! impact)    HURT (recovery)
  ·◆◈◆·                                   ·◆◈◆·
 ╔══╧══╗                                  ╔══╧══╗
 ║◉  !◉║                                  ║◉   ◉║
 ╚══╤══╝                                  ╚══╤══╝
╔═╪═══╪═╗                                ╔═╪═══╪═╗
║!║·  ║ ║                                ║ ║·  ║ ║
╠═╪═══╪═╣                                ╠═╪═══╪═╣
║ ║   ║ ║                                ║ ║   ║ ║

DEATH-1 (stagger)   DEATH-2 (fallen horizontal)   DEATH-3 (remnant)
   ·◆◈◆·
  ╔══╧══╗           ╔══╧══╗
  ║◉   ·║          ═╔╩═════╩╗═                ╔══╧══╗
  ╚══╤══╝╲         ═╠═╪═══╪═╣═              ═╩═════╩═
 ╔═╪═══╪═╗╲
 ║ ║·  ║  ╲           ·   ·   ·              ·  ◈  ·
 ╠═╪═══╪═╲
 ║ ║   ╲

PRIMAL AWARENESS (passive overlay — ∿ wave on idle)
 ∿·◆◈◆·∿
  ╔══╧══╗
  ║◉   ◉║
  ╚══╤══╝
 ╔═╪═══╪═╗
 ∿║ ║·  ║ ║∿
 ╠═╪═══╪═╣
```

---

### Husty — Neural Caster (Rarity 3 · `◉`)

Silhouette: slim, upright, never lunges. Energy radiates outward from stillness.
Palette sets `box → --accent-evasion` — the whole figure reads as psychic cyan.
Death is dispersal, not collapse.

```
IDLE-1           IDLE-2           IDLE-3
  ·◉·              ◉               ·◉·
  ╱│╲            ∿╱│╲∿             ╱│╲
∿  │  ∿            │             ∿  │  ∿
   │               │                │
   │               │                │
  ╱ ╲             ╱ ╲              ╱ ╲

ATTACK-1 (focus) ATTACK-2 (release) ATTACK-3 (exhale)
  ◉               ◉                ·◉·
  ╱│∿            ∿∿│∿∿             ╱│╲
   │∿∿          ∿∿ │ ∿∿∿——⚡       ∿  │  ∿
   │            ∿  │                  │
   │               │                  │
  ╱ ╲             ╱ ╲               ╱ ╲

DEATH-1          DEATH-2          DEATH-3          DEATH-4
  ◉               ·◉               · ◉ ·
  ╱│╲             ╱│·              · │ ·            ∿ ◉ ∿
   │ ∿             │∿              · · ·            ∿ · ∿
   │∿              │
   │              ╱╲
  ╱ ╲
```

---

### Netrolume Grunt — Frequency Beast (Rarity 1 · `▪`)

Silhouette: hunched, wide, asymmetric. Frequency ripples (`≋`) beat from
the body mass. Claws extend on lunge. Nothing is straight. Palette sets
`box → --text-muted`, `block → --text-muted` — dim organic mass.
Falls sideways on death; ripples die last.

```
IDLE-1           IDLE-2           IDLE-3
  ▄▪▄              ▄▪▄              ▄▪▄
≋▐███▌≋           ▐███▌           ≋▐███▌≋
 ▐█║█▌            ▐█║█▌≋          ≋▐█║█▌
  ▐║▌             ≋▐║▌              ▐║▌
 ▄▐║▌▄            ▄▐║▌▄            ▄▐║▌▄
╱▌   ▐╲          ╱▌   ▐╲          ╱▌   ▐╲

ATTACK (Clawd)
CROUCH           LUNGE            RECOVER
  ▄▪▄              ▄▪▄              ▄▪▄
 ▐███▌            ▐████╲          ≋▐███▌≋
 ▐█║▌╲          ≋▐██║██╲╲         ▐█║█▌
  ╱▐║▌          ╱╱▐▐║▌  ╲╲         ▐║▌
 ▄ ║  ▄                            ▄▐║▌▄
  ▌   ▐           ▌               ╱▌   ▐╲

DEATH-1          DEATH-2          DEATH-3          DEATH-4
  ▄▪▄              ▄▪               ▪               ·▪·
 ▐███▌            ▐██╲             ▐█·             · · ·
 ▐█║▌╲            ▐█╲               ╲             ≋ · ≋
  ▐║╲               ╲                             · · ·
 ▄ ╲ ▄               ╲
  ╲   ╲
```

---

### Kiragen Combatant — Alien Ranger (Rarity 3 · `⬡`)

Silhouette: lean, angular, tactical stance. Weapon (`║`) always present at
right side. Scan lines (`─ ─`) sweep across idle frames — Tactical Scan
passive made visible. Palette sets `box → --accent-info` (alien blue).

```
IDLE-1           IDLE-2           IDLE-3
  ─⬡─             ─⬡─              ─⬡─
  /│\             /│\              /│\
─ │ ─║          ─ ─│─ ─║          ─ │ ─║
  │  ║             │   ║            │   ║
 ╱│╲             ╱│╲              ╱│╲
╱   ╲           ╱   ╲            ╱   ╲

ATTACK
AIM              FIRE             RECOIL
  ─⬡─             ─⬡─              ─⬡─
  /│\─            /│\─             /│\
─ │  ─══║       ─ │  ─══║——⚡      │  ═║
  │     ║          │               │
 ╱│╲              ╱│╲             ╱│╲
╱   ╲            ╱   ╲           ╱   ╲

DEATH-1          DEATH-2          DEATH-3          DEATH-4
  ─⬡─              ⬡─               ⬡               · ·
  /│\─            /│╲─             /╲               · ⬡
─ │  ═║         ─ │              ─ │               · · ·
  │               │╲               │╲
 ╱│╲             ╱ ╲
╱   ╲
```

---

### Kiragen Controller — Alien Enchanter (Rarity 3 · `⬡`)

Silhouette: wider than Combatant, arms permanently extended — a conductor.
No weapon. Influence lines (`∿`) radiate outward on attack. Same faction
glyph as Combatant (`⬡`), distinguished by palette and pose alone.

```
IDLE-1           IDLE-2           IDLE-3
   ─⬡─            ─⬡─              ─⬡─
∿─ │ ─∿          ─ │ ─           ∿─ │ ─∿
╱══╪══╲          ╱══╪══╲          ╱══╪══╲
   │            ∿  │  ∿              │
  ╱│╲              ╱│╲             ╱│╲
 ╱   ╲           ╱   ╲            ╱   ╲

ATTACK
GATHER           RELEASE          HOLD
   ─⬡─            ─⬡─              ─⬡─
∿∿─ │ ─∿∿       ∿∿─ │ ─∿∿         ─ │ ─
╱∿═╪═∿╲         ╱══╪══╲——∿∿∿      ╱══╪══╲
  ∿│∿            ∿  │  ∿              │
  ╱│╲               ╱│╲             ╱│╲
 ╱   ╲            ╱   ╲            ╱   ╲

DEATH-1          DEATH-2          DEATH-3          DEATH-4
   ─⬡─              ─⬡               ⬡              ·⬡·
 ─ │ ─            ─ │╲─           ─ │╲          · · · · ·
╱══╪══╲           ╱══╪  ╲           ╪╲╲         · · · · ·
   │╲                │               ╲
  ╱│ ╲              ╱╲
 ╱   ╲
```

---

## Renderer

`SymbolFigure` component receives the current frame array (32 strings) and
renders one `<pre>` element. Each string is walked character by character:

1. Classify glyph via Unicode range check → palette key
2. Group consecutive same-key glyphs into one `<span style="color: ...">` 
3. `identity` key resolves `--rarity-N` from the character's `rarity` field
4. `base` key emits no span — character inherits default text color
5. Space characters emit as-is, no span

The renderer calls this once per frame change only — `FigureAnimator` fires
`onFrame` when the frame index advances, not on every rAF tick.

---

## Design Principles

1. **Silhouette first** — each character reads as a distinct shape at 50% zoom
2. **Asymmetry tells character** — Hugo symmetric (engineered); Grunt is not (feral)
3. **Palette is personality** — same frame strings, entirely different character through color alone
4. **Particles are faction-specific** — `·` nanite, `∿` psychic, `≋` frequency, `─` scanner
5. **Head is the anchor** — head symbol never moves; body moves around it
6. **Death reflects nature** — Hugo fragments, Husty disperses, Grunt topples, Kiragen folds clean
7. **Art in JSON is readable** — frame strings look like the character without running the renderer
