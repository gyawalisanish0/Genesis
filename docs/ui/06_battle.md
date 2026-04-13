# Screen: Battle

## Purpose

The core gameplay screen. Displays the vertical tick timeline on the left edge,
an opponent info card at top-right, a scrollable action log in the centre, the
player's status effects, a portrait panel, and a collapsible action grid.
Every interaction the player takes during a battle flows through this screen.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Pre-Battle (Step 3 CONTINUE) |
| **Exit to** | Battle Result (win/loss) · Main Menu (forfeit) |

---

## Dimensions

```
Canvas    : 360 × 640 dp   FULL-BLEED — edge-to-edge immersive
Timeline  : 28 dp wide strip on left edge, full height
Main area : 332 dp wide (x=28 to x=360)
```

---

## Layout Schematic

```
┌──┬─────────────────────────────────────────┐  y=0
│TL│  Opponent Info Card (rarity bg tint)    │  130dp  hidden on player turn
│TL│  name · class · portrait · HP · AP      │
│TL│  rarity colour · LVL badge · TU value   │
│TL├─────────────────────────────────────────┤  y=130
│TL│                                         │
│TL│  Action Log Box  (scrollable)           │  fills remaining space
│TL│                                         │
│TL├─────────────────────────────────────────┤  y=var
│TL│  ╭──[■]──[■]──[■]──╮  Status Slots     │  44dp
│TL├─────────────────────────────────────────┤
│  │ [Turn N] [Tick: N]  │  Basic  │ End/Sk │  48dp  action row 1
│  │                     │─────────┼────────│
│  │  ◉ portrait circle  │  Skill1 │ Skill2 │  72dp  skill row 1
│  │  LVL   CXP/NLU      │─────────┼────────│
│  │  HP ████ CHP/MHP    │  Skill3 │ Skill4 │  72dp  skill row 2
│  │  AP ██░░ CAP/MAP    │                  │
│  │                     │    [#1 toggle]   │  54dp  collapse button row
└──┴─────────────────────────────────────────┘  y=640
```

Left TL strip: 28 dp wide · full height · vertical tick axis, ally/enemy markers  
Portrait circle: 100 dp diameter, positioned bottom-left, overlaps status row boundary  
Skill columns: (332 − 8) / 2 = 162 dp each, 8 dp gap between columns

---

## Zone Breakdown

| Zone | Height | Visibility |
|---|---|---|
| Timeline strip | full height 640 dp | Always visible — 28 dp left column |
| Opponent info card | 130 dp | Visible only during enemy turn |
| Action log | fills remainder | Expands when opponent card hidden |
| Status slots pill | 44 dp | Always visible |
| Bottom area | 246 dp | Portrait + stats always; action grid collapsible |

---

## Component Specifications

### Vertical Timeline Strip (28 dp × full height)

The timeline is a **register-based infinite strip**. Its scrollable range is
derived from the set of registered tick positions — it does not have a fixed
length. Any unit, event, or effect can register a tick position; the strip
expands automatically to cover them all plus a 15-tick buffer at each end and
300 ticks of future range ahead of the now-line.

```
┌──────────────────────┐  ← dead-zone overlay (48 dp, bg-deep)
│  [unit SVG marker]   │
│  [now-line ─────────]│  ← global battle clock
│  [unit SVG marker]   │
│  [ghost marker ░░░░] │  ← grayscale history ghost
└──────────────────────┘  ← dead-zone overlay (48 dp, bg-deep)
```

Content scrolls **physically under** the 48 dp dead-zone overlays at top and
bottom (`::before` / `::after` pseudo-elements). The now-line and all markers
are part of the scrollable track — not fixed overlays.

**Now-line** — a 1 dp horizontal accent bar at `tickValue` (the global battle
clock). Moves with a `--motion-timeline` (200 ms ease-in-out) CSS transition
whenever `tickValue` advances. Auto-recenters to the bottom dead-zone edge
after 1.5 s of idle scroll.

**Unit markers** — 24 × 24 SVG, positioned at `unit.tickPosition`:

| Layer | Description |
|---|---|
| Background circle (r=9) | `bg-card` fill |
| HP track ring (r=10, 2 dp stroke) | `bg-elevated` — always full |
| HP fill arc (r=10, 2 dp stroke) | `accent-info` (ally) or `accent-danger` (enemy); arc length = `hp / maxHp × circumference`; starts from top (rotate −90°) |
| Portrait initial | Unit name first character; 7 px; `text-secondary` |

Active unit (currently at the now-line): pulsing `box-shadow` animation
(`markerPulse`, 1.5 s ease-in-out) on the wrapper div.

**History ghosts** — when a unit takes an action, a grayscale copy of their
marker is left at the old tick position (`filter: grayscale(1); opacity: 0.4;
pointer-events: none`). Rendered behind live markers in DOM order. HP arc is
shown as empty (hpFraction = 0) on ghosts.

**Scroll behaviour:**
- On mount: instant snap, now-line at bottom dead-zone inner edge
- On `tickValue` advance: smooth scroll to same anchor
- Manual scroll out-of-band: auto-recenter after `TIMELINE_RECENTER_DELAY_MS` (1500 ms)

**Constants** (all in `src/core/constants.ts`):

| Constant | Value | Purpose |
|---|---|---|
| `TIMELINE_PX_PER_TICK` | 10 px | Pixel height per tick unit |
| `TIMELINE_BUFFER_TICKS` | 15 | Extra ticks beyond outermost registered unit |
| `TIMELINE_OVERLAY_PX` | 48 | Dead-zone height — must match 3 rem in CSS |
| `TIMELINE_FUTURE_RANGE` | 300 | Ticks always kept visible ahead of now |
| `TIMELINE_RECENTER_DELAY_MS` | 1500 | Idle ms before auto-recenter fires |

---

### Opponent Info Card (332 × 130 dp)

Hidden (`height=0`, `opacity=0`) during the player's turn. Appears with a 0.15 s
fade when the enemy takes their turn.

| Component | Size (dp) | Properties |
|---|---|---|
| Card bg | 332 × 130 | Rarity tint bg (see rarity colours below); `$r-md` |
| Portrait | 64 × 64 | Circle; 8 dp left pad; vertically centred |
| Name | 200 × 18 | `$t-subheading` `$text-primary`; x=80, y=top+16 |
| Class label | 120 × 14 | `$t-micro` `$text-secondary`; below name |
| Rarity badge | auto × 16 | Coloured pill; rarity name `$t-micro` |
| HP bar | 200 × 10 | `ResourceBar HP`; x=80, below class label |
| AP bar | 200 × 8 | `ResourceBar AP`; below HP |
| TU value | 40 × 14 | "TU: N" `$t-micro` `$text-muted`; bottom-right |
| LVL badge | 36 × 14 | "LVL N" `$t-micro` `$accent-gold` pill |

**Rarity bg tints:**

| Rarity | Colour |
|---|---|
| Common | `#6B7280` 30% overlay |
| Uncommon | `#22C55E` 20% overlay |
| Rare | `#3B82F6` 20% overlay |
| Epic | `#A855F7` 20% overlay |
| Legendary | `#F59E0B` 20% overlay |

---

### Action Log (332 × variable dp)

Scrollable list of combat events. Oldest at top, newest at bottom. Auto-scrolls
to bottom on each new entry.

| Component | Properties |
|---|---|
| Log bg | `$bg-deep` |
| Log entry | `$t-micro` `$text-muted`; 24 dp height per line; left-padded 8 dp |
| Outcome line | Coloured by outcome type; `$t-label` weight |

---

### Status Slots Pill (332 × 44 dp)

Horizontally centred pill row showing the player's active status effects.

- Maximum **3 chips** visible
- If `len(unit.status_slots) > 3`: chips 0–2 visible + `+N` overflow label  
  where N = `len(unit.status_slots) − 3`
- **Tap any chip** → opens `StatusDetailPopup` for that status
- **Tap the `+N` label** → opens `StatusDetailPopup` in scrollable-list mode

| Component | Size (dp) | Properties |
|---|---|---|
| Pill bg | auto × 40 | `$bg-elevated` `$r-pill`; centred |
| Status chip | 32 × 32 | Icon + 2-char label; `$bg-card` `$r-pill` |
| Overflow label | 32 × 32 | `+N` `$t-label` `$text-secondary` |

---

### Player Portrait Panel (left column, 130 × 246 dp)

| Component | Size (dp) | Properties |
|---|---|---|
| Turn counter | auto × 20 | "Turn N" `$t-micro` `$text-secondary` |
| Tick value | auto × 20 | "Tick: N" `$t-micro` `$text-muted` |
| Portrait circle | 100 × 100 | `$accent-genesis` ring 3 dp; placeholder image |
| LVL label | auto × 16 | "LVL N" `$t-micro` `$accent-gold` |
| XP label | auto × 14 | "CXP/NLU" `$t-micro` `$text-muted` |
| HP label | 12 × 12 | "HP" `$t-micro` |
| HP bar | 100 × 8 | `ResourceBar HP`; value right-aligned |
| AP label | 12 × 12 | "AP" `$t-micro` |
| AP bar | 100 × 6 | `ResourceBar AP`; value right-aligned |

---

### Action Grid (right column, 202 × 246 dp)

Three rows stacked vertically. The entire grid is collapsible via the `#1` toggle.

```
┌──────────────┬───────────────┐  48dp
│    Basic     │   End/Skip    │
├──────────────┼───────────────┤  72dp
│    Skill 1   │    Skill 2    │
├──────────────┼───────────────┤  72dp
│    Skill 3   │    Skill 4    │
└──────────────┴───────────────┘
         [    #1 toggle    ]      54dp
```

Column width: (202 − 8) / 2 = 97 dp per column; 8 dp gap.

#### Skill Slot Layout (97 × 72 dp)

```
┌──────────────────────────┐
│  {Skill Name}       LVL  │  name left · LVL badge top-right
│                          │
│  TUC                CHRG │  bottom-left · bottom-right
└──────────────────────────┘
```

| Element | Properties |
|---|---|
| Slot bg | `$bg-card` `$r-md` |
| Skill name | `$t-label` `$text-primary`; top-left pad 6 dp |
| LVL badge | `$t-micro` `$accent-gold`; top-right corner |
| TUC label | "TU: N" `$t-micro` `$text-muted`; bottom-left |
| CHRG label | "×N" `$t-micro` `$text-secondary`; bottom-right |

#### Skill Slot States

| State | Visual change |
|---|---|
| Available | Full opacity; normal border |
| Insufficient AP | 50% opacity; border tinted `$accent-danger` |
| Empty | 30% opacity; name label shows "—" |
| Tap selected | `$accent-genesis` border 2 dp; scale 0.97 → proceeds to target |
| Long-press | Opens `SkillDetailPopup` (read-only, no upgrade action) |
| Enemy turn | `disabled=True`; 20% opacity |

#### Basic Attack (97 × 48 dp)

`$bg-elevated` `$r-md`; "Basic" `$t-label`; always enabled on player turn.
Shows TUC value below name.

#### End / Skip (97 × 48 dp)

`$bg-elevated` `$r-md`; "End/Skip" `$t-label` `$text-secondary`.
Ends the player's turn without using a skill.

---

### Skills Collapse Toggle (#1 Button)

A circular toggle button at the bottom of the right column.

| State | Icon | Behaviour |
|---|---|---|
| Expanded | ▼ | Grid visible; tap to collapse |
| Collapsed | ▲ | Grid hidden (height=0 animated 0.2 s); tap to expand |

The `#1` button is always visible regardless of collapse state.
Collapsed state removes the action grid height but keeps the portrait panel.

---

### Target Select Popup (`TargetSelectPopup`)

Opens when the player activates a skill and `len(alive_enemies) ≥ 2`.
If only 1 enemy is alive, the popup is skipped and the action resolves immediately.

`ModalView` centred, 85% screen width, height = 60 dp × enemy count + 40 dp header.

| Component | Properties |
|---|---|
| Header | "Select Target" `$t-subheading`; `$bg-elevated` |
| Enemy row | Portrait circle 32 dp + name `$t-label` + HP bar; 60 dp height |
| Cancel row | "Cancel" `$t-label` `$text-secondary` |

Tapping an enemy row dispatches `on_target_selected(unit)` and dismisses the popup.

---

### Skill Detail Popup (`SkillDetailPopup`)

Opens on long-press of any skill button. Read-only during battle.

`ModalView` centred, 85% screen width.

| Component | Properties |
|---|---|
| Skill name | `$t-subheading` `$text-primary` |
| LVL badge | `$accent-gold` pill |
| AP cost | "AP: N" `$t-label` |
| TU cost | "TU: N" `$t-label` |
| CHRG | "Charges: N" `$t-label` |
| Description | `$t-body` `$text-secondary`; wrapping |
| Close button | "Close" `$t-label` |

---

### Status Detail Popup (`StatusDetailPopup`)

Opens on tap of any status chip (or the `+N` overflow label).

When opened from `+N`, shows a scrollable list of all statuses.
When opened from a specific chip, shows that status at the top.

| Component | Properties |
|---|---|
| Status name | `$t-subheading` |
| Description | `$t-body` `$text-secondary`; wrapping |
| Duration | "N turns remaining" or "N ticks" `$t-micro` `$text-muted` |
| Source | "Applied by: Unit Name" `$t-micro` `$text-muted` |
| Close button | "Close" `$t-label` |

---

## Enemy Turn State

When an enemy acts:
- Opponent info card fades in (0.15 s) showing the acting enemy's details
- All 6 action buttons `disabled=True`, opacity 20%
- Log entry appended: "Enemy Name is acting…"
- After enemy action resolves, player turn state is restored

---

## Animations Summary

| Element | Token / duration | Trigger |
|---|---|---|
| Opponent card | height/opacity 0 ↔ visible, 150 ms ease | Turn switch |
| Now-line position | `--motion-timeline` (200 ms ease-in-out) | `tickValue` advance |
| Unit marker position | `--motion-timeline` (200 ms ease-in-out) | `registerTick` |
| Active marker pulse | `markerPulse` keyframe, 1.5 s ease-in-out infinite | Unit at now-line |
| History ghost appear | instant (rendered on action) | Action taken |
| Skill slot tap | scale 0.95, `--motion-button` (80 ms ease-in) | Button press |
| Skill grid collapse | height 0 ↔ full, 200 ms | Collapse toggle |
| HP / AP bars | width tween, `--motion-bar` (400 ms ease-out) | Damage / regen |
| Log scroll | smooth scroll to bottom | New log entry |
| Timeline scroll-to-anchor | `scrollTo behavior: smooth` | tick advance, recenter |
