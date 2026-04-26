# Screen: Battle

## Purpose

The core gameplay screen. Displays the vertical tick timeline on the left edge,
a turn display panel at top of the arena canvas (telegraphs incoming enemy actions
and confirms player actions), a **BATTLE LOG** button below the arena that opens a
slide-up overlay with the full combat history, the player's status effects, a
portrait panel, and a collapsible action grid. A full-screen dice result overlay
bursts on every skill resolution. Every interaction the player takes during a
battle flows through this screen.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Pre-Battle (Step 3 CONTINUE) |
| **Exit to** | Battle Result (win/loss) · Main Menu (forfeit via pause menu) |

**Battle entry guard:** if `BattleScreen` mounts with no team selected
(`playerUnit === null` after loading), it silently redirects to Pre-Battle.
This guards against direct URL access.

**Back button (in-battle strict pause loop):**
- First back press → pause overlay appears (`isPaused = true`)
- Second back press → resumes battle (`isPaused = false`)
- Navigation out is only possible via the **LEAVE BATTLE** button in the pause menu
- 300 ms debounce prevents accidental double-fires
- Works on both native (Capacitor `App backButton`) and web (browser back via `popstate` capture-phase interceptor in `ScreenContext`)

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
│TL│  ╔═════════════════════════════════════╗ │  ← Phaser canvas (BattleArena)
│TL│  ║  TurnDisplayPanel (top of canvas)  ║ │    fills this entire region
│TL│  ║  Unit figures · Dice · Feedback    ║ │
│TL│  ╚═════════════════════════════════════╝ │
│TL├─────────────────────────────────────────┤
│TL│  [               BATTLE LOG        ▲ ] │  32dp  log button row (right-aligned)
│TL├─────────────────────────────────────────┤
│TL│  ╭──[■]──[■]──[■]──╮  Status Slots     │  44dp
│TL├─────────────────────────────────────────┤
│  │ [ROLL (if skill)]   │      End/Skip     │  48dp  action row 1  ← ROLL btn visible when skill selected
│  │─────────────────────│─────────┼────────│
│  │ [Turn N] [Tick: N]  │  Skill1 │ Skill2 │  72dp  skill row 1
│  │  ◉ portrait circle  │─────────┼────────│
│  │  LVL   CXP/NLU      │  Skill3 │ Skill4 │  72dp  skill row 2
│  │  HP ████ CHP/MHP    │                  │
│  │  AP ██░░ CAP/MAP    │    [#1 toggle]   │  54dp  collapse button row
└──┴─────────────────────────────────────────┘  y=640

╔══════════════════════════════════════════════╗  ← DiceResultOverlay
║            BOOSTED  (text burst)             ║    position:absolute, centred
║           ─────────────────────             ║    z-index 40; pointer-events:none
╚══════════════════════════════════════════════╝    visible ~2s per action

╔══════════════════════════════════════════════╗  ← BattleLogOverlay (when open)
║  BATTLE LOG                            [✕]  ║    position:absolute, bottom-anchored
║ ─────────────────────────────────────────── ║    max-height 60%; z-index 30
║  Iron Warden → Slash on Swift Veil          ║    slide-up animation
║  Swift Veil evaded                          ║    auto-scroll to latest entry
╚══════════════════════════════════════════════╝    backdrop tap or ✕ to close
```

Left TL strip: 28 dp wide · full height · vertical tick axis, ally/enemy markers  
Portrait circle: 100 dp diameter, positioned bottom-left, overlaps status row boundary  
Skill columns: (332 − 8) / 2 = 162 dp each, 8 dp gap between columns

---

## Zone Breakdown

| Zone | Height | Visibility |
|---|---|---|
| Timeline strip | full height 640 dp | Always visible — 28 dp left column |
| Phaser arena canvas | flex:1 (fills remaining above HUD) | Always visible; TurnDisplayPanel + unit figures inside |
| BATTLE LOG button row | 32 dp | Always visible; right-aligned below canvas |
| Status slots pill | 44 dp | Always visible |
| Bottom area | 246 dp | Portrait + stats always; action grid collapsible |
| Dice result overlay | full area (position:absolute) | ~2 s per action; pointer-events:none |
| Battle log overlay | position:absolute, max 60% height, bottom-anchored | When BATTLE LOG button tapped |

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

The track shifts via CSS `transform: translateY` under the 48 dp dead-zone
overlays at top and bottom (`::before` / `::after` pseudo-elements). The
now-line and all markers are children of the translated track — not fixed
overlays.

**Now-line** — a 1 dp horizontal accent bar at `tickValue` (the global battle
clock). Does not move individually — the whole track translates so the now-line
sits at the bottom dead-zone inner edge. The translation is animated with
`--motion-timeline` (200 ms ease-in-out).

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

**Track position:**
- On mount: instant snap — track translates so now-line sits at the bottom dead-zone inner edge; no animation on first layout
- On `tickValue` advance: CSS transition (`--motion-timeline`) animates the track to the new anchor
- Manual drag (pointer-capture): pans the track in real time without animation; recenters after `TIMELINE_RECENTER_DELAY_MS` (1500 ms) of idle

**Constants** (all in `src/core/constants.ts`):

| Constant | Value | Purpose |
|---|---|---|
| `TIMELINE_PX_PER_TICK` | 10 px | Pixel height per tick unit |
| `TIMELINE_BUFFER_TICKS` | 15 | Extra ticks beyond outermost registered unit |
| `TIMELINE_OVERLAY_PX` | 48 | Dead-zone height — must match 3 rem in CSS |
| `TIMELINE_FUTURE_RANGE` | 300 | Ticks always kept visible ahead of now |
| `TIMELINE_RECENTER_DELAY_MS` | 1500 | Idle ms before auto-recenter fires |

---

### Turn Display Panel (332 × variable dp)

Sits above the action log. Unmounts entirely when no action is in progress
(returns `null`) — the action log expands to fill the freed space.

Each row slides down from above and fades in via `rowSlideIn` (200 ms
ease-out, `fill-mode: both`). Rows stagger: actor at 0 ms, skill at 150 ms,
target at 300 ms. When the actor row is omitted, delays shift down so skill
fires at 0 ms and target at 150 ms.

**When shown:**

| Trigger | Actor row | Notes |
|---|---|---|
| Enemy begins turn | Enemy name + class + rarity stars | Telegraphed **before** action fires; panel stays 6 s (covers 2 s AI delay + 4 s dice) |
| Player executes skill | _(omitted)_ | Shown **after** action resolves as a confirmation |

**Rows:**

| Row | Content | Accent |
|---|---|---|
| Actor (enemy only) | Name · Class · ★★★ rarity | 3 dp left border: `$accent-info` (ally) / `$accent-danger` (enemy) |
| Skill | Skill name (left) · TU cost (right) | — |
| Target | `→ Target name` or `→ Multiple Targets` | — |

Auto-dismisses 2 s after the action completes (`TURN_DISPLAY_DISMISS_MS`).
A new action replaces the previous display immediately — the dismiss timer resets.

**Implementation files:** `BattleContext.tsx` (`TurnDisplay` interface,
`showTurnDisplay` helper) · `TurnDisplayPanel.module.css` (`rowSlideIn`
keyframe) · `BattleScreen.tsx` (`TurnDisplayPanel` component, keyed by
`animKey` to force CSS animation retrigger).

---

### Dice Result Overlay (full area, position:absolute)

A full-screen centred outcome text burst that fires on every `runAttack` call
(both player and enemy actions). Implemented as `DiceResultOverlay` in
`BattleScreen.tsx`, rendered at `z-index: 40` inside `.root`
(`position: relative`). `pointer-events: none` — never blocks battle taps.

**Outcomes and colours (6 total):**

| Outcome | Token | Hex |
|---|---|---|
| Boosted  | `--accent-gold`    | `#F59E0B` |
| Success  | `--accent-heal`    | `#10B981` |
| GuardUp  | `--accent-info`    | `#3B82F6` |
| Evasion  | `--accent-evasion` | `#06B6D4` |
| Tumbling | `--accent-danger`  | `#EF4444` |
| Fail     | `--text-muted`     | dimmed text |

**Layout inside the burst:**

```
    [OUTCOME NAME]          ← .outcomeName — 1.75rem; colour from OUTCOME_COLORS
    ─────────────           ← accent divider line
    [flavour message]       ← .outcomeMsg — body size; inherited colour, 85% opacity
```

The flavour message is built by `buildOutcomeMessage(outcome, actorName, targetName, tumbleDelay)`:

| Outcome | Message |
|---|---|
| Boosted  | `{actor} gets +50% skill value boost until next turn` |
| Success  | `{actor} successfully hits` |
| GuardUp  | `{actor} hits and gains 35% damage reduction for next attack` |
| Evasion  | `{target} evaded` |
| Tumbling | `{actor} hits with half effectiveness, tumbled for N ticks` |
| Fail     | `{actor} misses` |

**`outcomeSlam` keyframe (4 s, `animation-fill-mode: forwards`):**

```
0%   opacity 0 · scale(0.4) · blur(8px)   ← slam-in start
12%  opacity 1 · scale(1.25) · blur(0)    ← peak overshoot
22%            · scale(0.95)              ← bounce back
32%            · scale(1.05)              ← micro bounce
40%            · scale(1.0)              ← settle
65%  opacity 1 · scale(1.0)              ← hold
100% opacity 0 · scale(1.02)             ← fade out
```

Auto-dismisses at 4 s (`DICE_RESULT_DISMISS_MS`). Rapid successive actions
cancel the previous dismiss timer — each new roll replaces the burst
immediately. React `key={animKey}` forces full unmount/remount to retrigger
the CSS animation even when the outcome is unchanged.

**Implementation files:** `BattleContext.tsx` (`DiceResult` interface,
`showDiceResult(outcome, message)` helper, `buildOutcomeMessage()`, called from
`runAttack`) · `DiceResultOverlay.module.css` · `BattleScreen.tsx`
(`DiceResultOverlay` component, `OUTCOME_COLORS` map).

---

### BATTLE LOG Button (332 × 32 dp row)

A small pill button pinned to the right side of the row directly below the arena
canvas. Tapping it opens the Battle Log overlay. Always visible during battle.

| Component | Properties |
|---|---|
| Row bg | `$bg-deep` |
| Button | `$bg-elevated` fill; 1 dp `$bg-panel` border; `$r-sm`; `$text-secondary`; 0.625 rem / 600 weight; `var(--touch-min)` min height |
| Label | `BATTLE LOG` — all caps, tracked |

---

### Battle Log Overlay (position:absolute, max 60% height)

Slide-up panel showing the full battle log history. Opens from the BATTLE LOG
button; closed by tapping ✕, tapping the semi-transparent backdrop, or pressing
the back button (the back press is consumed — it does not trigger the pause loop).

Auto-scrolls to the latest entry each time it opens or a new entry arrives while
the overlay is visible.

| Component | Properties |
|---|---|
| Backdrop | `rgba(0,0,0,0.55)`; `z-index: 30`; tap to close |
| Panel | `$bg-panel`; top corners `0.75rem` radius; slides up via `slideUp` animation (`--motion-modal`) |
| Header | `BATTLE LOG` label left · ✕ button right; 1 dp `$bg-elevated` border-bottom |
| Entry list | `overflow-y: auto`; `flex:1`; each entry coloured by outcome token |
| Entry | `0.6875rem` font-size; colour from `entry.colour ?? --text-muted` |

**Implementation files:** `BattleLogOverlay.tsx` · `BattleLogOverlay.module.css` ·
`BattleScreen.tsx` (`logOpen` state, `BATTLE LOG` button, back-button intercept)

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

### Player Portrait Column (left column, 130 × 246 dp)

The portrait column stacks the ROLL button above the portrait panel.

#### ROLL Button (full column width × 48 dp)

Visible **only** when the player has selected a skill (`selectedSkill !== null`).
Sits above the portrait circle and below the action row.

| State | Visual |
|---|---|
| Normal | `$accent-genesis` background; "ROLL" label; `$t-label` |
| Rolling (250 ms) | `rollPulse` opacity animation; "Rolling…" label |

Tapping ROLL triggers a 250 ms pulse, then fires `executeSkill(selectedSkill)` and
`selectSkill(null)`.

#### Portrait Panel

| Component | Size (dp) | Properties |
|---|---|---|
| Turn counter | auto × 20 | "Turn N" `$t-micro` `$text-secondary`; N = `playerUnit.actionCount + 1`; updates after dice ends |
| Tick value | auto × 20 | "Tick: N" `$t-micro` `$text-muted` |
| Portrait circle | 100 × 100 | `$accent-genesis` ring 3 dp; placeholder image |
| Class/rarity badge | auto × 16 | `ClassName ★N` `$t-micro` `$accent-gold` |
| HP row | full width | Label "HP" + `ResourceBar hp` + `"N/MAX"` value `$t-micro` `$text-muted` |
| AP row | full width | Label "AP" + `ResourceBar ap` + `"N/MAX"` value `$t-micro` `$text-muted` |

HP/AP numerals and the turn counter all update simultaneously when `playerUnit` state
commits after the dice animation (via `playerApplyTimerRef`). On End/Skip they update
immediately since there is no dice animation.

---

### Action Grid (right column, 202 × 246 dp)

Three rows stacked vertically. The entire grid is collapsible via the `#1` toggle.

```
┌──────────────────────────────┐  48dp
│           End/Skip           │
├──────────────┬───────────────┤  72dp
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
| Selected | `$accent-genesis` border 2 dp + inset shadow; ROLL button appears above portrait |
| Insufficient AP | 50% opacity; border tinted `$accent-danger` |
| Empty | 30% opacity; name label shows "—" |
| Long-press | Opens `SkillDetailPopup` (read-only, no upgrade action) |
| Enemy turn | `disabled=True`; 20% opacity |

**Tap to select / deselect**: tapping an available skill calls `selectSkill(skillInst)`.
Tapping the already-selected skill calls `selectSkill(null)`. After ROLL or End/Skip,
selection is cleared automatically.

#### End / Skip (full width × 48 dp)

`$bg-elevated` `$r-md`; "End/Skip" `$t-label` `$text-secondary`.
Advances the player's tick by 10 without using a skill. Disabled during enemy turn.

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

When an enemy acts, four stages fire in strict sequence:

| Stage | When | What happens |
|---|---|---|
| 1 — Telegraph | After remaining player dice ends | `TurnDisplayPanel` shows enemy actor + skill + target; panel stays for 6 s total |
| 2 — Attack | Telegraph + 2 s (`ENEMY_AI_DELAY_MS`) | `runAttack()` fires; `DiceResultOverlay` bursts for 4 s |
| 3 — State apply | Attack + 4 s (`DICE_RESULT_DISMISS_MS`) | HP bars and tick positions update **after** dice animation ends |
| 4 — Phase advance | Immediately after state apply | `registerTick` fires → `tickValue` auto-advances → `phase → 'player'` |

- All action buttons `disabled`, opacity 20% while `phase === 'enemy'`
- Log entry appended with outcome and damage at attack time
- Telegraph panel auto-dismisses 6 s after it appears (aligned with dice end)

---

## Animations Summary

| Element | Duration / easing | Trigger |
|---|---|---|
| Turn display panel rows | `rowSlideIn` 400 ms `cubic-bezier(0.34,1.25,0.64,1)` + scale(0.96→1), staggered 0/250/500 ms | Action start |
| Turn display panel dismiss | unmount after `TURN_DISPLAY_DISMISS_MS` (2 s) player / 6 s enemy | Action resolved |
| Dice result overlay | `outcomeSlam` 4 s ease-out forwards | Every `runAttack` |
| Dice result dismiss | unmount after `DICE_RESULT_DISMISS_MS` (4 s) | Timer after roll |
| Roll button pulse | `rollPulse` 250 ms opacity, "Rolling…" label | ROLL tapped |
| Roll / action / skill button press | 60 ms `ease-in` press-down → 280 ms `cubic-bezier(0.34,1.56,0.64,1)` spring release | Pointer down/up |
| Now-line position | `--motion-timeline` (200 ms ease-in-out) | `tickValue` advance |
| Unit marker position | 500 ms `cubic-bezier(0.34,1.56,0.64,1)` elastic spring | `registerTick` after dice ends |
| Active marker pulse | `markerPulse` keyframe, 1.5 s ease-in-out infinite | Unit at now-line |
| History ghost appear | instant (rendered on action) | Action taken |
| Skill slot selected | `$accent-genesis` border + inset shadow | Skill tapped |
| Skill grid collapse | height 0 ↔ full, 200 ms | Collapse toggle |
| HP / AP bars | width tween, `--motion-bar` (400 ms ease-out) | Damage / regen — fires after dice |
| Log entry appear | `logEntryIn` 200 ms ease-out (left-slide fade-in) | New log entry appended |
| Log scroll | smooth scroll to bottom | New log entry |
| Timeline track position | `transform: translateY`, `--motion-timeline` (200 ms ease-in-out) | tick advance, drag release + recenter |
