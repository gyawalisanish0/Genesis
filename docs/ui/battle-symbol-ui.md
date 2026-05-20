# Battle UI — Symbol Animation Design

Genesis uses a text-symbol visual language for battle. No sprite images are
required. Player imagination fills the gap between the symbols and the world.

---

## Philosophy

> "Let player imagination work as the graphics card."

Most text games leave symbols static. Most sprite games leave imagination out.
Genesis does neither. Unicode symbols are composed into character figures,
given CSS poses, and animated in time with the battle engine's step machine.
The result feels like nothing else on mobile — extremely lightweight, no asset
pipeline, works everywhere.

The rule: **symbols suggest; imagination completes.**

---

## Outcome Symbols

Each dice result has a dedicated symbol and a motion signature.

| Outcome  | Symbol | Motion                                      | Colour token        |
|----------|--------|---------------------------------------------|---------------------|
| Hit      | `⚔`    | Slides from acting figure toward target     | `--accent-heal`     |
| Boosted  | `★`    | Bursts outward (scale 1 → 2 → 1), repeats  | `--accent-gold`     |
| Evade    | `◎`    | Target side-steps, symbol bounces off       | `--accent-evasion`  |
| Miss     | `✕`    | Fades in briefly, shrinks away              | `--text-muted`      |

The existing `DicePanel` slot-machine spin is the prototype for this: faces
cycle through random outcomes before landing on the result. The symbol
animation system extends that idea across the whole battle stage.

---

## Projectile Symbols

Attack type determines the projectile symbol that travels between figures.

| Attack type | Symbol | Travel motion                   |
|-------------|--------|---------------------------------|
| Melee       | `⚔`    | Short lunge, no air travel      |
| Energy      | `⚡`   | Fast straight line, fades out   |
| Magic       | `✦`    | Arc with slight wobble          |
| Arrow       | `→`    | Linear, medium speed            |
| Generic     | `•`    | Fast linear                     |

Projectile is a single `<span>` absolutely positioned, animated with a CSS
`transform: translateX` keyframe timed to `ANIM_TIMEOUT_MS`.

---

## Character Figures

Each unit is a small `<pre>` composition of Unicode symbols arranged into a
recognisable humanoid silhouette. The head symbol is coloured by rarity tier
using `--rarity-N` tokens — giving instant visual identity without any image.

### Poses

Three text arrangements cover the full battle lifecycle.

```
    ◈              ◈              ◈
   ╱║╲            ╱║—⚔           ╲║
    ║              ║              ║╱
   ╱ ╲            ╱              ╲

  IDLE           ATTACK          HURT
```

A fourth pose, `DEATH`, scatters the symbols apart and fades:

```
  ◈
╲    ╱║
  ║╱
```

Pose is a CSS class on the figure container; switching pose is a single
`classList` change. CSS handles the transition.

### Enemy mirroring

The target figure is the same symbol composition with `transform: scaleX(-1)`
applied, so it faces the acting unit. The rarity head symbol still reads
correctly because Unicode glyphs are symmetric on the vertical axis.

---

## Animation Principles

All motion is CSS-only (keyframes + transitions). No JavaScript animation loops.
Timing is driven by the same constants the engine uses.

| Event            | CSS mechanic                              | Duration          |
|------------------|-------------------------------------------|-------------------|
| Idle breathe     | `translateY` loop, `ease-in-out`          | 2 s repeat        |
| Slide-in entrance| `translateX` from ±offscreen              | `SLIDE_MS` 300 ms |
| Attack lunge     | `translateX` toward target, then snap back| `ANIM_TIMEOUT_MS` |
| Hit flash        | Background colour burst, fade             | 140 ms            |
| Death            | `rotate` + `opacity` 0, symbols scatter   | 420 ms            |
| Projectile fly   | `translateX` full gap width               | 300–600 ms        |
| Outcome burst    | `scale` keyframe on outcome symbol        | 220 ms            |

---

## Stage Layout

```
┌──────────────────────────────────────┐
│  [TurnDisplayPanel — top strip]      │
├──────────────────────────────────────┤
│                                      │
│    ◈            ⚡            ◈       │
│   ╱║╲    ─────────────→     ╲║╱      │
│    ║                          ║      │
│   ╱ ╲                        ╱ ╲     │
│                                      │
│     Iron Warden      Swift Veil      │
│  [ ████████░░ ] HP  [ ██░░░░░░ ] HP  │
│                                      │
│   ─────── ⚔ HIT  34 dmg ──────────  │
│                                      │
├──────────────────────────────────────┤
│  [Dice / outcome overlay]            │
├──────────────────────────────────────┤
│  [Skill grid / action buttons]       │
└──────────────────────────────────────┘
```

HP bars use Unicode block characters (`█ ░`) animated via CSS `width` — no
canvas required.

---

## Class Hierarchy (React)

```
BattleStage          ← replaces BattleArena + BattleScene
  FigurePanel        ← single unit figure (pose + name + HP bar)
    SymbolFigure     ← the ◈ / ╱║╲ / ╱ ╲ composition, pose-aware
    SymbolBar        ← █░ HP / AP bar
  ProjectileLayer    ← absolutely positioned, renders flying symbols
  OutcomeBurst       ← ⚔ ★ ◎ ✕ overlay, keyframe-driven
  DicePanel          ← existing slot-machine spin (already symbol-based)
```

`BattleStage` receives the same engine callbacks that `BattleArena` did
(`onSetTurnState`, `onPlayDice`, `onPlayAttack`, `onPlayDeath`). The engine
does not change.

---

## Character Definition (future)

Each `CharacterDef` (or `AnimationManifest` equivalent) will carry a
`symbolFigure` block:

```jsonc
"symbolFigure": {
  "head": "◈",           // rarity-coloured automatically
  "poses": {
    "idle":   ["    ◈", "   ╱║╲", "    ║", "   ╱ ╲"],
    "attack": ["    ◈", "   ╱║—", "    ║", "   ╱   "],
    "hurt":   ["    ◈", "   ╲║ ", "    ║╱", "   ╲   "],
    "death":  ["  ◈  ", "╲    ║", "    ╱ ", "        "]
  }
}
```

If absent, the engine falls back to a generic humanoid figure. This mirrors
how `animations.json` is optional today — the system degrades gracefully.

---

## Why This Works

- **No assets** — zero image loading, zero texture atlas, instant startup
- **Accessible** — screen readers can read the symbol labels; no canvas blind spots
- **Themeable** — swap the symbol set (e.g. sci-fi: `◉ ╠═╣`) without touching logic
- **Scalable** — works at any font size; `--app-scale` transform keeps it sharp
- **Distinctive** — no other mobile game uses this approach; it becomes a visual identity
