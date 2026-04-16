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
| dp canvas | **360 × 640 dp** |
| Asset design size | 1080 × 1920 px (3×); export 1× and 2× fallbacks |

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

Inset values are **read at runtime** from `display_service.get_safe_insets()`.
They vary per device — never hardcode them.

### Reference Insets (fallback when platform cannot report)

| Inset | Default dp | Note |
|---|---|---|
| Top | 24 dp | Camera / status bar region |
| Bottom | 48 dp | Gesture bar / home indicator |
| Left | 0 dp | Portrait — no side insets |
| Right | 0 dp | Portrait — no side insets |

### Content Zone (using reference insets)

| Property | dp | Note |
|---|---|---|
| Content top | 24 dp | Below top inset |
| Content bottom | 592 dp | Above bottom inset (640 − 48) |
| Content height | 568 dp | Safe interactive area |
| Side padding | 12 dp | Inside safe area left/right |
| Content width | 336 dp | 360 − 12 − 12 |

> Screen docs use these reference insets for ASCII schematics.
> Actual runtime values will vary per device.

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
| `$accent-warn` | `#F97316` | Tumbling outcome, Guard Up |
| `$accent-danger` | `#EF4444` | HP bar, damage numbers, death |
| `$accent-evasion` | `#06B6D4` | Evasion outcome, dodge |

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
| Boosted | `$accent-gold` | `#F59E0B` |
| Success | `$accent-heal` | `#10B981` |
| Tumbling | `$accent-danger` | `#EF4444` |
| Guard Up | `$accent-info` | `#3B82F6` |
| Evasion | `$accent-evasion` | `#06B6D4` |

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
