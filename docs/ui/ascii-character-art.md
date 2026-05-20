# ASCII Character Art — Frame-by-Frame Animation Spec

Each character is a composition of Unicode box-drawing, block, and symbol
characters arranged in a fixed **11 × 7 grid** (11 chars wide, 7 lines tall).
Frames are swapped by CSS class at a configurable `frameMs` rate. Motion
(translate, scale, rotate) is layered on top via CSS keyframes — the art
itself never moves, only the container transforms.

---

## Grid Standard

```
·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·    ← 11 chars wide
·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·    ← 7 lines tall
·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
```

- `monospace` font, `1ch` × `1.2em` cell
- Head symbol occupies row 1, always centred
- Head colour = `--rarity-N` token — only the head symbol is coloured
- All other symbols inherit `--text-primary` or `--text-secondary`
- Enemy figures are `scaleX(-1)` mirrored at the container level

---

## Animation States

| State    | Frames | Frame rate | Loop    | Container motion                    |
|----------|--------|------------|---------|-------------------------------------|
| `idle`   | 3      | 600 ms     | forever | `translateY(0 → -2px → 0)` 2 s     |
| `attack` | 3      | 100 ms     | once    | container slides toward target      |
| `hurt`   | 2      | 80 ms      | once    | `translateX(-4px → 0)` flash        |
| `death`  | 4      | 180 ms     | once    | `rotate(0 → 15deg)` + `opacity → 0`|
| `dodge`  | 2      | 90 ms      | once    | container slides away from attacker |

---

## Head Symbols by Rarity

| Rarity | Symbol | Token         |
|--------|--------|---------------|
| 1      | `▪`    | `--rarity-1`  |
| 2      | `◆`    | `--rarity-2`  |
| 3      | `◉`    | `--rarity-3`  |
| 4      | `◈`    | `--rarity-4`  |
| 5      | `✦`    | `--rarity-5`  |
| 6      | `❋`    | `--rarity-6`  |

---

## Hugo Rekrot — ANBOT Nanite Warrior (Rarity 4)

**Identity:** Hugo's body is piloted by ANBOT nanite swarms. Limbs reshape
on command — blade for Nanites Slash, hammer for Hammer Bash, shell for
Shelling Point. The silhouette is dense and symmetrical; nanite particles
orbit the figure at rest. At low HP, Primal Awareness reroutes everything
into evasion — the art shifts to a crouched, particle-scattered form.

**Head symbol:** `◈` (gold, rarity-4)

### IDLE (3 frames, 600 ms each — breathing loop)

```
IDLE-1                IDLE-2                IDLE-3
                                            
   ·◈·               ··◈··                  ·◈·
  ═╪═╪═              ═╪═╪═                 ═╪═╪═
  ╠·║·╣              ╠ ║ ╣                 ╠·║·╣
 ╱╚═╦═╝╲            ╱╚═╦═╝╲              ╱╚═╦═╝╲
  ║   ║               ║   ║                ║   ║
 ═╧═ ═╧═             ═╧═ ═╧=             ═╧═ ═╧═
  ·   ·                                    ·   ·
```

*Nanite particles (`·`) pulse in and out. Body plate lines (`═`) hold steady.*

### ATTACK — Nanites Slash (3 frames, 100 ms each)

```
ATTACK-1 (coil)       ATTACK-2 (strike)     ATTACK-3 (recover)

   ◈                      ◈                     ·◈·
  ═╪═╗                 ═╪═╪═══⚔               ═╪═╪═
  ╠ ║╗╣                ╠ ║                     ╠·║·╣
 ╱╚═╦╝                ╱╚═╦═╝╲               ╱╚═╦═╝╲
  ║   ║                  ║                    ║   ║
 ═╧═ ═╧═              ═╧═                   ═╧═ ═╧═
```

*Right arm collapses inward on coil, extends into blade on strike.*

### ATTACK — Hammer Bash (3 frames)

```
ATTACK-1 (raise)      ATTACK-2 (slam)       ATTACK-3 (recover)

   ◈                      ◈                     ·◈·
  ═╪▓▓                 ═╪═╪═                   ═╪═╪═
  ╠ ║▓▓╲              ╠▓▓║ ╣                   ╠·║·╣
 ╱╚═╦═╝              ╲╚▓▓╦═╝╲                ╱╚═╦═╝╲
  ║   ║                  ║                    ║   ║
 ═╧═ ═╧═              ═╧═                   ═╧═ ═╧═
```

*Arm mass consolidates (`▓▓`) before driving downward.*

### HURT (2 frames, 80 ms each)

```
HURT-1                HURT-2

   ◈                      ·◈·
 ·═╪═╪═·              ═╪═╪═
  ╠!║!╣                ╠ ║ ╣
╲╚═╦═╝                ╱╚═╦═╝╲
  ║   ║                ║   ║
 ═╧═ ═╧═              ═╧═ ═╧═
```

*Figure jolts left. `!` marks on chest plate indicate impact zone.*

### DEATH (4 frames, 180 ms each)

```
DEATH-1               DEATH-2               DEATH-3               DEATH-4

   ◈                     ◈·                   ·◈·                  · · ·
  ═╪═╪═                ·═╪═·                  ·═·                  · · ·
  ╠ ║ ╣╲              ╠ ║╲                   ·║·                   · ◈ ·
 ╱╚═╦═╝              ╱╚═╦·                   ╦·                   · · ·
  ║   ║                ║                      ·
 ═╧═  ╲              ═╧═
```

*Structure collapses. Final frame: nanite particles dispersing.*
*"I... miscalculated."*

### PRIMAL AWARENESS (passive active — overlay on idle)

```
PRIMAL-1              PRIMAL-2

  ∿◈∿               ∿·◈·∿
  ═╪═╪═              ═╪═╪═
  ╠∿║∿╣              ╠ ║ ╣
 ╱╚═╦═╝╲            ╱╚═╦═╝╲
 ∿║   ║∿             ∿║ ║∿
 ═╧═ ═╧═             ═╧═ ═╧═
```

*`∿` wave symbols pulse around the figure when Primal Awareness is active.*

---

## Husty — Neural Caster (Rarity 3)

**Identity:** Lean and upright. Husty does not move toward the enemy —
the attack comes from Husty. Energy radiates outward. The figure is calm
at rest; attack frames show the energy focusing and releasing, not the
body lunging.

**Head symbol:** `◉` (rarity-3)

### IDLE (3 frames)

```
IDLE-1                IDLE-2                IDLE-3

  ·◉·                  ◉                    ·◉·
  ╱│╲                ∿╱│╲∿                 ╱│╲
∿  │  ∿               │                  ∿  │  ∿
   │                   │                    │
   │                   │                    │
  ╱ ╲                 ╱ ╲                  ╱ ╲
                      · ·                        
```

*`∿` energy wisps drift in and out. Figure does not bob — stillness is
the tell.*

### ATTACK — Disruption (3 frames)

```
ATTACK-1 (focus)      ATTACK-2 (release)    ATTACK-3 (exhale)

  ◉                    ◉                     ·◉·
  ╱│∿                ∿∿│∿∿                  ╱│╲
   │∿∿              ∿∿ │ ∿∿∿——⚡            ∿  │  ∿
   │                ∿  │                       │
   │                   │                       │
  ╱ ╲                 ╱ ╲                     ╱ ╲
```

*Energy gathers inward then erupts laterally. No body motion.*

### ATTACK — Cached Shockwave (3 frames)

```
CHARGE-1              CHARGE-2              RELEASE

 ∿∿◉∿∿              ∿∿∿◉∿∿∿              ∿∿∿◉∿∿∿
∿ ╱│╲ ∿            ∿∿╱│╲∿∿             ∿∿∿│∿∿∿——⚡⚡
∿  │  ∿            ∿∿ │ ∿∿            ∿∿∿ │ ∿∿∿——⚡⚡
∿  │  ∿            ∿∿ │ ∿∿                │
   │                ∿ │ ∿                 │
  ╱ ╲              ∿╱ ╲∿                ╱ ╲
```

*Energy wraps tighter each frame before detonating outward.*

### HURT (2 frames)

```
HURT-1                HURT-2

 ·◉·                   ◉
╲╱│╲                  ╱│╲
  │!                    │
  │                     │
  │                     │
 ╱ ╲                   ╱ ╲
```

### DEATH (4 frames)

```
DEATH-1               DEATH-2               DEATH-3               DEATH-4

  ◉                    ·◉                   · ◉ ·
  ╱│╲                  ╱│·                  · │ ·                  ∿ ◉ ∿
   │ ∿                  │∿                  · · ·                  ∿ · ∿
   │∿                   │                                          ∿ · ∿
   │                   ╱╲
  ╱ ╲
```

*Form dissolves into particles. Not a collapse — a dispersal.*

---

## Netrolume Grunt — Frequency Beast (Rarity 1)

**Identity:** Hunched, wide, predatory. Carries frequency — the "Hertz
Beats" passive vibrates through its body as wave patterns (`≋`). Claws
are visible in the attack frames. No symmetry. Every line is slightly
off-axis, suggesting constant low-level tremor. It does not stand still.

**Head symbol:** `▪` (rarity-1)

### IDLE (3 frames)

```
IDLE-1                IDLE-2                IDLE-3

  ▄▪▄                  ▄▪▄                  ▄▪▄
≋▐███▌≋              ▐███▌               ≋▐███▌≋
 ▐█║█▌               ▐█║█▌≋              ≋▐█║█▌
  ▐║▌                 ≋▐║▌                ▐║▌
 ▄▐║▌▄               ▄▐║▌▄              ▄▐║▌▄
╱▌   ▐╲             ╱▌   ▐╲             ╱▌   ▐╲
```

*`≋` frequency ripples pulse outward from the body mass.*

### ATTACK — Clawd (3 frames)

```
CROUCH                LUNGE                 RECOVER

  ▄▪▄                  ▄▪▄                  ▄▪▄
 ▐███▌               ▐████╲              ≋▐███▌≋
 ▐█║▌╲             ≋▐██║██╲╲            ▐█║█▌
  ╱▐║▌             ╱╱▐▐║▌  ╲╲            ▐║▌
 ▄ ║  ▄                                 ▄▐║▌▄
  ▌   ▐              ▌                  ╱▌   ▐╲
```

*Body mass shifts forward. Claws (`╲`) extend on lunge.*

### ATTACK — Quick Charge (3 frames)

```
CHARGE-1              CHARGE-2              IMPACT

  ▄▪▄                                       ▄▪▄
≋▐███▌             ≋≋≋▄▪▄≋≋≋             ▐████╲
 ▐██║╱             ≋▐████▌≋            ≋▐████╲╲
  ▐╱                ╱▐╱╱                    ╲╲
 ▄╱  ▄             ▄╱   ▄
  ▌   ▐
```

*Frequency rings (`≋`) intensify before the burst. Figure blurs.*

### HURT (2 frames)

```
HURT-1                HURT-2

  ▄▪▄!                 ▄▪▄
!▐███▌               ▐███▌
 ▐█!█▌               ▐█║█▌
  ▐!▌≋                ▐║▌
 ▄╲║▌▄               ▄▐║▌▄
╱ ▌ ▐╲              ╱▌   ▐╲
```

### DEATH (4 frames)

```
DEATH-1               DEATH-2               DEATH-3               DEATH-4

  ▄▪▄                  ▄▪                    ▪                     ·▪·
 ▐███▌                ▐██╲                  ▐█·                   · · ·
 ▐█║▌╲               ▐█╲                    ╲                     ≋ · ≋
  ▐║╲                  ╲                                           · · ·
 ▄ ╲ ▄                  ╲
  ╲   ╲
```

*Falls sideways. Frequency ripples die last.*

---

## Kiragen Combatant — Alien Ranger (Rarity 3)

**Identity:** The Kiragen are a coordinated alien faction — angular,
efficient, no wasted mass. The Combatant is a sensor-and-strike unit:
lean torso, wide tactical stance, holds a ranged weapon permanently.
The "Tactical Scan" passive suggests the figure is always reading the
battlefield — small scan-line details in the art (`─ ─`) suggest
active sensor sweeps.

**Head symbol:** `⬡` (hexagonal — alien geometry, rarity-3)

### IDLE (3 frames)

```
IDLE-1                IDLE-2                IDLE-3

  ─⬡─                  ─⬡─                  ─⬡─
  /│\                  /│\                  /│\
─ │ ─║              ─ ─│─ ─║              ─ │ ─║
  │  ║                 │   ║                │   ║
 ╱│╲                  ╱│╲                  ╱│╲
╱   ╲               ╱   ╲               ╱   ╲
```

*`─ ─` scan lines sweep left-right on frames 1→3. Weapon (`║`) held
at right side, always present.*

### ATTACK — Ranged Strike (3 frames)

```
AIM                   FIRE                  RECOIL

  ─⬡─                  ─⬡─                  ─⬡─
  /│\─                  /│\─                /│\
─ │  ─══║            ─ │  ─══║——⚡          │  ═║
  │     ║               │                   │
 ╱│╲                   ╱│╲                 ╱│╲
╱   ╲               ╱   ╲               ╱   ╲
```

*Weapon arm extends (`══`) then recoils.*

### HURT (2 frames)

```
HURT-1                HURT-2

  ─⬡!                  ─⬡─
 /│\                   /│\
─!│  ═║              ─ │ ─║
  │   ║                │   ║
 ╱│╲                  ╱│╲
╱   ╲               ╱   ╲
```

### DEATH (4 frames)

```
DEATH-1               DEATH-2               DEATH-3               DEATH-4

  ─⬡─                   ⬡─                   ⬡                    · ·
  /│\─                 /│╲─                  /╲                    · ⬡
─ │  ═║              ─ │                    ─ │                    · · ·
  │                    │╲                    │╲
 ╱│╲                  ╱ ╲
╱   ╲
```

---

## Kiragen Controller — Alien Enchanter (Rarity 3)

**Identity:** The Controller commands from stillness. No weapon. Both arms
extend outward — not attacking, directing. The "Vast Influence" passive
suggests lines of control radiating from this figure toward allies and
enemies alike. The silhouette is wider and more imposing than the
Combatant, suggesting authority.

**Head symbol:** `⬡` (same faction glyph, rarity-3)

### IDLE (3 frames)

```
IDLE-1                IDLE-2                IDLE-3

   ─⬡─                 ─⬡─                  ─⬡─
∿─ │ ─∿              ─ │ ─                ∿─ │ ─∿
╱══╪══╲             ╱══╪══╲              ╱══╪══╲
   │               ∿  │  ∿                  │
  ╱│╲                 ╱│╲                  ╱│╲
 ╱   ╲              ╱   ╲               ╱   ╲
```

*Arms wide (`══`) — a conductor's pose. `∿` influence lines pulse.*

### ATTACK — Control Burst (3 frames)

```
GATHER                RELEASE               HOLD

   ─⬡─                 ─⬡─                  ─⬡─
∿∿─ │ ─∿∿           ∿∿─ │ ─∿∿             ─ │ ─
╱∿═╪═∿╲            ╱══╪══╲——∿∿∿          ╱══╪══╲
  ∿│∿               ∿  │  ∿                  │
  ╱│╲                  ╱│╲                  ╱│╲
 ╱   ╲              ╱   ╲               ╱   ╲
```

*`∿` influence lines gather at arms then extend outward toward target.*

### HURT (2 frames)

```
HURT-1                HURT-2

   ─⬡!                  ─⬡─
!─ │ ─               ─ │ ─
╱!═╪═!╲             ╱══╪══╲
   │                    │
  ╱│╲                  ╱│╲
 ╱   ╲               ╱   ╲
```

### DEATH (4 frames)

```
DEATH-1               DEATH-2               DEATH-3               DEATH-4

   ─⬡─                  ─⬡                    ⬡                   ·⬡·
 ─ │ ─               ─ │╲─               ─ │╲              · · · · · ·
╱══╪══╲             ╱══╪  ╲                ╪╲╲              · · · · · ·
   │╲                   │                   ╲
  ╱│ ╲                 ╱╲
 ╱   ╲
```

---

## JSON Definition — `symbolFigure` block

Each `CharacterDef` will carry an optional `symbolFigure` key. If absent,
the renderer uses the generic humanoid fallback.

```jsonc
"symbolFigure": {
  "headSymbol": "◈",
  "frameMs": {
    "idle":   600,
    "attack": 100,
    "hurt":   80,
    "death":  180,
    "dodge":  90
  },
  "frames": {
    "idle":   ["frame string\nline2\nline3...", "frame2...", "frame3..."],
    "attack": ["frame1...", "frame2...", "frame3..."],
    "hurt":   ["frame1...", "frame2..."],
    "death":  ["frame1...", "frame2...", "frame3...", "frame4..."],
    "dodge":  ["frame1...", "frame2..."]
  }
}
```

Frame strings use `\n` as line separator. The renderer splits on `\n`,
renders each line in a `<span>`, and replaces the head symbol character
with a coloured `<span style="color: var(--rarity-N)">`.

---

## Rendering Component

```
SymbolFigure
  props: { frames, headSymbol, rarityN, state, flipped }
  
  - currentFrame = frames[state][tick % frames[state].length]
  - tick increments via requestAnimationFrame gated by frameMs[state]
  - state changes reset tick to 0
  - flipped = true on target figure → CSS scaleX(-1) on container
  - head symbol replaced with <span className={styles.head}> inline
```

No canvas. No Phaser. A `<pre>` element inside a positioned container.

---

## Design Principles

1. **Silhouette first** — each character readable at 50% zoom as a distinct shape
2. **Asymmetry tells character** — Hugo is symmetric (engineered); the Grunt is not (feral)
3. **One detail per state** — attack frames change one thing clearly (arm position, mass shift)
4. **Particles are personality** — `·` `∿` `≋` `─` each belong to one character family
5. **Head is the anchor** — the head symbol never moves; the body moves around it
6. **Death dissolves, not collapses** — each character's death reflects their nature:
   Hugo: structure fragments · Husty: disperses · Grunt: falls sideways · Kiragen: topples clean
