# Genesis — Design System

The foundation layer: canvas, pixel grid, palette, type, motion. Every
component in `01-components.md` and every screen in `02-screens.md` is built
from what is defined here.

**Art direction: GBA-era pixel art.** Chunky, limited-palette, hard-edged
sprite work in the register of a Game Boy Advance RPG — read at arm's length
on a phone, not squinted at.

---

## 1. Canvas

| Property | Value |
|---|---|
| CSS canvas width | **360 dp** (fixed — defines the rem base) |
| CSS canvas height | device-adaptive — physical height ÷ scale |
| Physical target | 1080 × 1920 px portrait (xxhdpi, 1 dp = 3 px) |
| Orientation | portrait only |

The inner canvas is always 360 dp wide; height flexes so every portrait device
fills edge-to-edge with no letterbox. All screen layouts use flex/grid so
content zones expand and contract with available height.

Scaling, safe-area insets, and the three fullscreen delivery paths (Capacitor
native, installed PWA, plain browser tab) are specified in `CLAUDE.md` —
**§ Display & Full-Screen Rules**. Not repeated here.

Safe area is consumed only via `var(--safe-top)` / `--safe-bottom` /
`--safe-left` / `--safe-right`. Backgrounds bleed into insets; interactive
elements never do.

---


## Viewport adaptation

The design canvas is a fixed **360 dp column**, scaled to the device by
`useViewportScale`. Two guards apply and the smaller wins:

```
scale = min(w / 360, h / 640)
```

| Term | Prevents |
|---|---|
| `w / 360` | the column rendering wider than the viewport |
| `h / 640` | zooming so far that under 640 dp of design height remains |

640 dp is the shortest height screens are laid out to survive. Both guards are
required: with only the width guard, a 1024 × 1366 tablet scaled to 2.84× and
left 480 dp of height, which clipped the main menu's bottom row off-screen with
no way to reach it. Tablets pillarbox; landscape letterboxes; phones fill the
width. Tall phones simply get more than 640 dp to lay out in — screens must
tolerate extra height, never assume exactly 640.

Two layout rules follow from the fixed column, and both have already caused
real clipping:

- **`.viewportInner` must not be a shrinkable flex item.** It is a fixed 360 px
  box that a transform scales. As a default flex item it shrank on viewports
  narrower than 360 px, compounding with the transform and laying content out
  in ~280 design px.
- **Flex/grid children that must fit need `min-width: 0`.** The default
  `min-width: auto` refuses to shrink below content's intrinsic width, so the
  action grid kept its preferred width and overflowed the canvas rather than
  taking the space left over.

Verify across sizes with `src/utils/__tests__/useViewportScale.test.ts`, which
asserts the height invariant against a real device matrix.

## 2. The Pixel Grid

This is the rule the whole art direction hangs on.

> **1 art pixel = 2 dp.** The art canvas is **180 art px** wide.

360 dp ÷ 2 = 180. At xxhdpi one art pixel is 6 physical px — a clean integer at
every density bucket (mdpi 2 px, xhdpi 4 px, xxhdpi 6 px). Nothing ever lands
on a half pixel, so nothing ever blurs.

**Every art asset is authored at 1× (art pixels) and displayed at exactly 2×.**
Never author at the display size. Never scale by a non-integer factor.

### Standard sizes

| Asset | Art px | Rendered dp |
|---|---|---|
| Battle sprite (standard) | 48 × 48 | 96 × 96 |
| Battle sprite (boss / elite) | 64 × 64 | 128 × 128 |
| Dungeon tile | 24 × 24 | 48 × 48 |
| Dungeon entity token | 16 × 16 | 32 × 32 |
| Portrait | 32 × 32 | 64 × 64 |
| Status / skill icon | 16 × 16 | 32 × 32 |
| Small icon (chip, badge) | 8 × 8 | 16 × 16 |
| Panel border slice | 4 | 8 |

The 48 art px battle sprite is 26.7 % of the 180 px canvas — the same
proportion a 64 px GBA battler occupies on a 240 px screen. The framing reads
correctly because the ratio is preserved, not the raw number.

### Pixel rules

These are non-negotiable; they are what makes it read as pixel art rather than
as small blurry art.

1. **No antialiasing.** Every image element carries `image-rendering: pixelated`.
2. **No gradients.** Use a 2-colour ordered dither where a transition is needed.
3. **No soft shadows / blurs.** Depth is one hard 1-art-px offset in a darker
   ramp step. `box-shadow` blur radius is always `0`.
4. **No sub-pixel geometry.** Every size, offset, and radius is a multiple of
   2 dp. Corner radii are stepped by the nine-slice, not by `border-radius`.
5. **No opacity fades on sprites.** Fade by swapping to a darker ramp step or
   by frame-dropping, not by animating `opacity` on sprite art.
6. **Glow is the one licensed exception.** The neon accents keep a `text-shadow`
   /`box-shadow` glow (see `--glow-*` tokens) on *UI chrome only* — never on
   sprite art. It is what keeps Genesis sci-fi rather than fantasy.

---

## 3. Palette

Pixel art needs **ramps**, not isolated colours. Each hue is a small ladder of
steps; shading picks a neighbouring step rather than mixing a new value. Ten
ramps, ~40 colours total — a deliberate constraint.

Ramps are the raw material. **Components reference semantic tokens, never ramp
steps directly.**

### Ramps

| Ramp | 1 (darkest) | 2 | 3 | 4 | 5 (lightest) |
|---|---|---|---|---|---|
| `hull` — chrome, backgrounds | `#02080e` | `#061422` | `#0a1d30` | `#0f2840` | `#1e4060` |
| `bone` — text, light neutrals | `#3a6a92` | `#5a9dc0` | `#8fc4dd` | `#d8f0ff` | `#ffffff` |
| `cyan` — brand, selection, energy | `#004a5c` | `#0089a8` | `#00c2e6` | `#00e5ff` | `#9df4ff` |
| `azure` — AP, information | `#002d4d` | `#0067b3` | `#0099ff` | `#7ac6ff` | — |
| `blood` — HP, damage, defeat | `#4d0a1c` | `#a3123a` | `#ff2257` | `#ff7a99` | — |
| `moss` — healing, buffs | `#00432c` | `#009962` | `#00ff9f` | `#8fffd0` | — |
| `amber` — boosted, legendary | `#4d3d00` | `#b39a00` | `#ffe100` | `#fff08a` | — |
| `flare` — warnings, alerts | `#4d2a00` | `#b36200` | `#ff8c00` | `#ffbe73` | — |
| `void` — evade, omega | `#390049` | `#8000ad` | `#bf00ff` | `#dd8aff` | — |
| `rust` — Mars terrain | `#1c0d06` | `#3d1f10` | `#5c2f18` | `#8a4526` | `#cc7040` |

### Semantic tokens

These are the names components use. They already exist in
`src/styles/tokens.css`; the change is that each now resolves to a **named ramp
step** rather than a free-floating hex.

| Token | Ramp step |
|---|---|
| `--bg-deep` | `hull-1` |
| `--bg-panel` | `hull-2` |
| `--bg-card` | `hull-3` |
| `--bg-elevated` | `hull-4` |
| `--bg-overlay` | `hull-1` @ 92 % |
| `--text-primary` | `bone-4` |
| `--text-secondary` | `bone-2` |
| `--text-muted` | `hull-5` |
| `--text-on-accent` | `hull-1` |
| `--accent-genesis` | `cyan-4` |
| `--accent-silver` | `cyan-5` |
| `--accent-info` | `azure-3` |
| `--accent-danger` | `blood-3` |
| `--accent-heal` | `moss-3` |
| `--accent-gold` | `amber-3` |
| `--accent-warn` | `flare-3` |
| `--accent-evasion` | `void-3` |

### Dice outcome colours

| Outcome | Token |
|---|---|
| Boosted | `--accent-gold` |
| Hit | `--text-primary` |
| Evade | `--accent-evasion` |
| Fail | `--text-muted` |

### Rarity

| Tier | Name | Token |
|---|---|---|
| 1 | Normal | `--rarity-1` `#4a7a9b` |
| 2 | Advance | `--rarity-2` `#00d084` |
| 3 | Super | `--rarity-3` `#00aaff` |
| 4 | Epic | `--rarity-4` `#aa44ff` |
| 5 | Master | `--rarity-5` `#ff8c00` |
| 6 | Legend | `--rarity-6` `#ff2257` |
| 7 | Omega | **2-frame alternation** — see below |

Rarity 7 was a CSS gradient. Gradients are banned (rule 2). Omega instead
**alternates** its border between `cyan-4` and `void-3` on a 2-frame,
500 ms-per-frame loop. Discrete, on-grid, and it reads as *more* special than a
gradient because nothing else in the UI moves that way.

---

## 4. Typography

Two families, split by job. Pixel fonts are excellent for chrome and unreadable
for paragraphs; this hybrid is the pragmatic answer, not a compromise.

| Role | Family | Applied to |
|---|---|---|
| **Chrome** | pixel/bitmap face (`--font-pixel`) | Titles, headings, labels, numbers, buttons, HP/AP values, menu items |
| **Prose** | geometric sans (`--font-sans`, Nunito) | Skill descriptions, battle log, dialogue, settings copy |

Pixel-font sizes must be integer multiples of the face's native em (typically
8 px) or the glyph grid breaks. Prose sizes are free.

| Token | Size | Weight | Line height | Family | Use |
|---|---|---|---|---|---|
| `--t-display` | 32 dp | 700 | 40 dp | pixel | Screen titles, big damage numbers |
| `--t-heading` | 24 dp | 600 | 32 dp | pixel | Section headers |
| `--t-subheading` | 16 dp | 600 | 24 dp | pixel | Card titles, unit names |
| `--t-label` | 12 dp | 500 | 16 dp | pixel | Tags, stat values, buttons |
| `--t-micro` | 8 dp | 400 | 12 dp | pixel | Tick numbers, badges |
| `--t-body` | 14 dp | 400 | 20 dp | sans | Descriptions, log lines |
| `--t-body-sm` | 12 dp | 400 | 18 dp | sans | Secondary prose |

Pixel text is never antialiased: `-webkit-font-smoothing: none`.

---

## 5. Spacing & Radius

All spacing is a multiple of the 2 dp art pixel; most are multiples of 8 dp
(4 art px), matching the panel border slice.

| Token | Value | Art px |
|---|---|---|
| `--s-xs` | 4 dp | 2 |
| `--s-sm` | 8 dp | 4 |
| `--s-md` | 16 dp | 8 |
| `--s-lg` | 24 dp | 12 |
| `--s-xl` | 32 dp | 16 |
| `--s-2xl` | 48 dp | 24 |

**Corner radius is deleted from the system.** GBA-era chrome has stepped
corners drawn into the nine-slice, not smooth curves. `--r-sm` … `--r-xl` are
retired; `--r-pill` survives only for non-art elements (circular tap targets
whose shape is functional, e.g. the dice hotzone).

**Minimum touch target: 48 × 48 dp** (`--touch-min`). Any glyph smaller than
that gets an invisible padded hit area — a 16 dp status chip still needs 48 dp
of tappable space.

---

## 6. Panels — the nine-slice box

The single most recognisable piece of GBA chrome: a hard 2-tone bordered box.
Everything that groups content uses it. There is no other container style.

```
╔══════════════════════╗   outer  1 art px  bone-3
║ ┌──────────────────┐ ║   inner  1 art px  hull-5
║ │                  │ ║   fill              hull-2
║ │     content      │ ║
║ │                  │ ║   border slice: 4 art px (8 dp)
║ └──────────────────┘ ║   corners drawn in, never border-radius
╚══════════════════════╝
```

| Variant | Outer | Inner | Fill | Use |
|---|---|---|---|---|
| `default` | `bone-3` | `hull-5` | `hull-2` | Panels, sheets, dialogue |
| `raised` | `bone-4` | `hull-5` | `hull-3` | Buttons, interactive cards |
| `sunken` | `hull-5` | `hull-1` | `hull-1` | Bar tracks, input wells |
| `active` | `cyan-4` | `cyan-1` | `hull-3` | Selected / focused |
| `danger` | `blood-3` | `blood-1` | `hull-2` | Destructive confirm |

**Implementation** (`components/Panel.tsx`): the outer line is a real
`border`, the inner line a zero-blur `inset` `box-shadow`. Both stay exactly
1 art px at any size, and no corner is ever rounded. Each variant only sets
three tokens — `--panel-outer`, `--panel-inner`, `--panel-fill` — so consumers
never touch colour directly.

`border-image` with a 4-art-px slice is the upgrade path once border art is
authored; the variant tokens carry over unchanged. It is not used today
because a data-URI source cannot read CSS custom properties, which would force
literal colour back into stylesheets.

---

## 7. Motion

GBA animation is **stepped**, not eased. This is the difference between
"pixel art" and "pixel art that moves like a modern web app".

| Type | Duration | Easing | Use |
|---|---|---|---|
| Sprite animation | per-frame from manifest | `steps(n)` | All sprite sheet playback |
| Screen transition | 200 ms | `steps(4)` | Push / pop |
| Sheet in | 200 ms | `steps(4)` | Bottom sheet rise |
| Sheet out | 120 ms | `steps(3)` | Bottom sheet drop |
| Bar tween (HP/AP) | 400 ms | `steps(16)` | Resource change — ticks down visibly |
| Button press | 80 ms | none | 1 art px (2 dp) downward offset |
| Damage number | 800 ms | `steps(8)` | Rise and cut (no fade) |
| Timeline marker | 200 ms | `steps(4)` | Reposition |
| Omega rarity | 1000 ms loop | `steps(2)` | 2-frame border alternation |

**Rule:** anything that moves sprite art or resource bars uses `steps()`.
Only non-art chrome (a backdrop dimming, a glow pulse) may use a continuous
ease, because it isn't made of pixels.

`reduceAnimations` in `AppSettings` collapses every duration above to `0 ms`
and holds final frames.

---

## 8. Tilesets

`TilesetDef.tiles[id]` carries:

| Field | Meaning |
|---|---|
| `color` | Base fill — used directly until tile art is authored |
| `art` | Optional tile-sheet frame stem under `images/tilesets/{key}/` |

Tiles are 24 × 24 art px (48 dp cells). While `art` is absent the dungeon
renders flat `color` fills; passable and impassable terrain must therefore stay
distinguishable by colour alone. The Mars set follows this: `rust-5` floor,
`rust-3` hill, `rust-2` crater, `rust-1` rift.

Rotation is applied by the renderer via `TileTypeDef.rotation`; author **one**
orientation per tile and let the four rotations come for free.

---

## 9. Asset pipeline

```
public/images/
  characters/{defId}/
    portrait.png              32 × 32 art px
    {state}/0.png, 1.png …    48 × 48 art px, 0-indexed frames
    UI/Status/{icon}.png      16 × 16 art px
  tilesets/{key}/{art}.png    24 × 24 art px
```

Sprite timing, frame counts, and aura config live in
`characters/{defId}/animations.json` (`AnimationManifest`) — the manifest is
the sprite contract, and it is validated by `animationManifestSchema`. Per-skill
choreography lives in `anim_sequence.json` (`AnimPhase[]`).

**Export at 1× only.** The renderer scales by exactly 2×. Shipping a
pre-scaled 2× asset defeats the pixel grid and will look softer than the 1×
source, not sharper.

---

## 10. What this replaces

This file supersedes the previous fourteen `docs/ui/*.md` files. Consolidated
here: `00_design_system.md`, `11_fullscreen_plan.md` (now a pointer to
`CLAUDE.md`). Deleted outright as obsolete: `ascii-character-art.md`,
`battle-symbol-ui.md`.

The old design-system doc specified a **purple** palette (`#8B5CF6`) that the
shipped `tokens.css` never used — it has been cyan since implementation. That
drift is resolved here in favour of the shipped values.
