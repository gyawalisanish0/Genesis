# UI Design System — Genesis

Shared design language referenced by every screen doc. All values are
**dp** (density-independent pixels) for layout and **sp** for text.

---

## Canvas & Full-Screen Target

Genesis runs **full-bleed immersive** on every screen — no system chrome is
ever visible. The physical target is 1080 × 1920 px portrait (Full HD).

### Resolution Reference

| Property | Value |
|---|---|
| Physical target | 1080 × 1920 px (Full HD portrait) |
| Density bucket | xxhdpi — 480 dpi — 1 dp = 3 px |
| dp canvas width | **360 dp** (fixed — defines the rem base) |
| dp canvas height | **device-adaptive** — equals physical screen height ÷ scale |
| Design reference height | 640 dp (used in screen docs / ASCII schematics only) |
| Asset design size | 1080 × 1920 px (3×); export 1× and 2× fallbacks |

The inner canvas is **always 360 dp wide**. Height is not fixed — it equals the physical screen height divided by the scale factor, so every portrait device fills edge-to-edge with no letterbox. All screen layouts use flex so content zones expand or contract with the available height. The 640 dp figure appears in screen schematics as a reference; it is not enforced at runtime.

### Fullscreen delivery paths

| Context | Mechanism | Notes |
|---|---|---|
| Capacitor native (Android/iOS) | `StatusBar.hide()` + `setOverlaysWebView(true)` via `DisplayService` | Hides status bar before first JS frame; nav bar hidden via native `onWindowFocusChanged` (deferred to after `npx cap add android`) |
| PWA installed (home screen) | `display: standalone` in `public/manifest.json` | No browser chrome; no Fullscreen API needed; `SplashScreen` detects this and auto-navigates |
| Plain browser tab | `requestFullscreen()` on first tap via `DisplayService` listener | `SplashScreen` shows "TAP ANYWHERE TO ENTER" gate after loading; first tap fires fullscreen + navigates |

Always write layout in **dp**. Design and slice assets at 1080 × 1920 px then
export downscaled copies for lower density buckets.

### Full-Bleed Canvas

```
┌──────────────────────────────────────────┐  px: 0,0    dp: 0,0
│▓▓▓▓▓▓ CAMERA / NOTCH ZONE  ▓▓▓▓▓▓▓▓▓▓▓│  ← device-reported top inset
├──────────────────────────────────────────┤
│                                          │
│                                          │
│         TRUE CONTENT ZONE                │  dynamic height
│    (interactive elements live here)      │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│▓▓▓▓▓▓ GESTURE / HOME BAR  ▓▓▓▓▓▓▓▓▓▓▓▓│  ← device-reported bottom inset
└──────────────────────────────────────────┘  px: 1080,1920   dp: 360,640

  ▓▓▓ = safe-area inset — backgrounds bleed here; buttons must not
```

Inset values are **read at runtime** via CSS `env(safe-area-inset-*)` exposed as
`var(--safe-top)`, `var(--safe-bottom)`, `var(--safe-left)`, `var(--safe-right)` in
`src/styles/tokens.css`. These CSS vars automatically divide by `var(--app-scale)` so
they remain physically correct when the viewport is scaled by `useViewportScale`.
Never hardcode inset values — always use the `var(--safe-*)` tokens.

### Reference Insets (ASCII schematic values only)

These values appear in screen schematics for layout illustration. They are **not** CSS fallbacks — `tokens.css` uses `0rem` as the fallback so no phantom padding appears on browsers/desktop without physical insets. Actual insets are always reported by `env(safe-area-inset-*)` on real devices.

| Inset | Schematic dp | Typical device range |
|---|---|---|
| Top | 24 dp | 24–59 dp (camera / status bar) |
| Bottom | 48 dp | 20–34 dp (gesture bar / home indicator) |
| Left | 0 dp | Portrait — no side insets |
| Right | 0 dp | Portrait — no side insets |

### Content Zone (using schematic insets)

| Property | dp | Note |
|---|---|---|
| Content top | 24 dp | Below top inset |
| Content bottom | 592 dp | Above bottom inset (640 − 48) |
| Content height | 568 dp | Safe interactive area |
| Side padding | 12 dp | Inside safe area left/right |
| Content width | 336 dp | 360 − 12 − 12 |

> Screen docs use these reference insets for ASCII schematics.
> Actual runtime values vary per device and are always read dynamically.

---

## Colour Tokens

### Backgrounds
| Token | Hex | Use |
|---|---|---|
| `$bg-deep` | `#0A0A14` | Root background, darkest layer |
| `$bg-panel` | `#12122A` | Cards, panels, drawers |
| `$bg-card` | `#1C1C3A` | Interactive card surfaces |
| `$bg-elevated` | `#26264A` | Buttons, focused states |
| `$bg-overlay` | `#000000CC` | Modal backdrop (80% opacity) |

### Accent
| Token | Hex | Use |
|---|---|---|
| `$accent-genesis` | `#8B5CF6` | Primary brand, active states, timeline |
| `$accent-gold` | `$F59E0B` | Boosted outcome, rare rarity |
| `$accent-info` | `#3B82F6` | AP bar, information |
| `$accent-heal` | `#10B981` | Healing, positive buffs |
| `$accent-warn` | `#F97316` | Warnings, alerts |
| `$accent-danger` | `#EF4444` | HP bar, damage numbers, death |
| `$accent-evasion` | `#06B6D4` | Evade outcome, dodge |

### Text
| Token | Hex | Use |
|---|---|---|
| `$text-primary` | `#F1F0FF` | Body text, labels |
| `$text-secondary` | `#9B8EC4` | Subtitles, metadata |
| `$text-muted` | `#5C5480` | Disabled, placeholder |
| `$text-on-accent` | `#FFFFFF` | Text on coloured buttons |

### Dice Outcome Colours
| Outcome | Token | Colour |
|---|---|---|
| Boosted | `$accent-gold`    | `#F59E0B` |
| Hit     | `$text-primary`   | `#F1F0FF` |
| Evade   | `$accent-evasion` | `#06B6D4` |
| Fail    | `$text-muted`     | `#5C5480` |

### Rarity Colours
| Tier | Token | Colour |
|---|---|---|
| 1 — Common | `$rarity-1` | `#6B7280` |
| 2 — Uncommon | `$rarity-2` | `#10B981` |
| 3 — Rare | `$rarity-3` | `#3B82F6` |
| 4 — Epic | `$rarity-4` | `#8B5CF6` |
| 5 — Legendary | `$rarity-5` | `#F59E0B` |
| 6 — Mythic | `$rarity-6` | `#F97316` |
| 7 — Omega | `$rarity-7` | gradient `#8B5CF6 → #F59E0B` |

---

## Typography Scale

All text uses a **geometric sans-serif** (Nunito or equivalent, bundled in
`assets/fonts/`).

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `$t-display` | 36 sp | Bold 700 | 44 sp | Screen titles, big damage numbers |
| `$t-heading` | 22 sp | SemiBold 600 | 28 sp | Section headers |
| `$t-subheading` | 16 sp | SemiBold 600 | 22 sp | Card titles, unit names |
| `$t-body` | 14 sp | Regular 400 | 20 sp | Body, descriptions |
| `$t-label` | 12 sp | Medium 500 | 16 sp | Tags, small labels |
| `$t-micro` | 10 sp | Regular 400 | 14 sp | Timestamps, combat log |

---

## Spacing Scale

| Token | Value |
|---|---|
| `$s-xs` | 4 dp |
| `$s-sm` | 8 dp |
| `$s-md` | 16 dp |
| `$s-lg` | 24 dp |
| `$s-xl` | 32 dp |
| `$s-2xl` | 48 dp |

---

## Corner Radius

| Token | Value | Use |
|---|---|---|
| `$r-sm` | 4 dp | Small chips, tags |
| `$r-md` | 8 dp | Cards, buttons |
| `$r-lg` | 16 dp | Large cards, panels |
| `$r-xl` | 24 dp | Bottom sheets, modals |
| `$r-pill` | 999 dp | Badges, icon buttons |

---

## Touch Targets

> **Minimum touch target: 48 × 48 dp** (CLAUDE.md rule)

Any visual element smaller than 48 dp must have an invisible hit area padded
to 48 × 48 dp.

---

## Reusable Components

### UnitPortrait
```
┌────────────┐
│            │  Size: 64 × 64 dp (default)
│  [image]   │  Corner: $r-md
│            │  Border: 2dp $rarity-N colour
└────────────┘
  ▔▔▔ HP ▔▔▔   HP bar: full width, 6dp tall, $accent-danger fill
```

Sizes: `sm` 40×40 dp · `md` 64×64 dp · `lg` 96×96 dp · `xl` 120×120 dp

---

### ResourceBar
```
 Label   [████████████░░░░░░░░]  value/max
  12sp          full width        12sp
```

| Variant | Height | Fill colour |
|---|---|---|
| HP | 8 dp | `$accent-danger` |
| AP | 6 dp | `$accent-info` |
| XP | 4 dp | `$accent-genesis` |

Background: `$bg-elevated`, corner `$r-pill`.

---

### SkillButton
```
┌──────────────────────────────────┐  168 × 72 dp
│ [icon 32dp]  Skill Name     Lv 2 │  — $t-subheading + $t-label
│ ▓▓▓▓▓▓▓▓░░ AP bar (6dp)        │
│ AP: 20  ·  TU: 8                 │  — $t-micro, $text-secondary
└──────────────────────────────────┘
```

States:
- **Available** — normal, `$bg-card` surface
- **Insufficient AP** — dimmed 50%, `$text-muted` label
- **Active turn** — `$accent-genesis` border 2dp
- **Upgrading** — pulsing `$accent-gold` border

---

### StatusEffectChip
```
╭────────╮
│ [icon] │  24 × 24 dp, $r-pill
│  3     │  stack count badge: 16×16dp, $t-micro
╰────────╯
```

---

### PrimaryButton
```
╭──────────────────────────────────╮  full-width × 56dp
│          BUTTON LABEL            │  $t-subheading, $text-on-accent
╰──────────────────────────────────╯  $accent-genesis fill, $r-md
```

| Variant | Height | Background |
|---|---|---|
| Primary | 56 dp | `$accent-genesis` |
| Secondary | 56 dp | `$bg-elevated` |
| Danger | 56 dp | `$accent-danger` |
| Ghost | 48 dp | transparent, border 1dp `$bg-elevated` |

---

### PagedGrid

Generic paged grid used by Roster (3×3) and Team Select (5×4). Configurable columns × rows.

**Layout:** Flexbox with `justify-content: center`. Partial rows (fewer items than the column
count) are automatically centered — cards never cluster to the left edge.
Each cell width is computed from `--pagedgrid-cols` via:
`flex-basis: calc((100% - (cols - 1) × gap) / cols)`

```
Full page (3 cols, 9 cards):          Partial page (3 cols, 2 cards):

┌────┐ ┌────┐ ┌────┐                     ┌────┐ ┌────┐
│card│ │card│ │card│   row 1             │card│ │card│   centered
└────┘ └────┘ └────┘                     └────┘ └────┘
┌────┐ ┌────┐ ┌────┐
│card│ │card│ │card│   row 2
└────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐
│card│ │card│ │card│   row 3
└────┘ └────┘ └────┘
  ‹  ● ○ ○  1/3  ›     pagination row (hidden when ≤1 page)
```

| Component | Properties |
|---|---|
| Arrow buttons `‹` / `›` | `var(--touch-min)` (48dp) tap target; disabled opacity 0.3 at first/last page |
| Dot indicators | 6dp circles; active dot `$accent-genesis`; inactive `$bg-elevated` |
| Page counter | `$t-micro` `$text-muted`; format "N/M" |
| Swipe | Pointer delta ≥ 40px left/right triggers page change |
| Partial rows | Centered horizontally via `justify-content: center` — no left-clustering |

---

### TimelineMarker
```
 ╭────╮
 │port│  24 × 24 dp, $r-pill
 ╰────╯
   ▲
   tick label  $t-micro
```

Active (current turn) marker: 32 × 32 dp, `$accent-genesis` ring 2dp, pulse
animation.

---

## Navigation Map

```
Splash
  └── Main Menu
        ├── Roster
        │     └── Character Detail
        │           └── (back to Roster)
        ├── Pre-Battle ──────────────────────────────────────────┐
        │     ├── Step 1: Mode Select                            │
        │     ├── Step 2: Team Compose                           │
        │     └── Step 3: Genesis Items ── Battle ───────────────┤
        │                                    └── Battle Result ──┘
        │                                          └── (back to Main Menu or retry)
        ├── Mastery Road
        │     └── (per-character quest detail, no sub-screen)
        └── Settings
              └── (back to Main Menu)
```

---

## Motion Principles

| Type | Duration | Easing | Use |
|---|---|---|---|
| Screen transition | 300 ms | ease-out | Push / pop between screens |
| Modal in | 250 ms | ease-out | Bottom sheet slide-up |
| Modal out | 200 ms | ease-in | Bottom sheet slide-down |
| Dice result | 2 s | ease-out (`outcomeSlam`) | Outcome text burst: slam-in → settle → hold → fade |
| Damage number | 800 ms | ease-out | Float-up and fade |
| Timeline scroll | 200 ms | ease-in-out | Marker reposition |
| Button press | 80 ms | ease-in | Scale 0.95 feedback |
| AP/HP bar update | 400 ms | ease-out | Width tween |
