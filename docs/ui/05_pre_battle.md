# Screen: Pre-Battle

## Purpose

Three-step wizard that guides the player from choosing a game mode through
composing their team and equipping Genesis Items before entering combat.
Each step lives on the same screen surface; a step indicator tracks progress.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Main Menu (PLAY button) |
| **Exit to** | Battle (confirm on Step 3) · Main Menu (back from Step 1) |

---

## Dimensions

```
Canvas     : 360 × 640 dp
Safe zone  : 360 × 568 dp
Side pad   : 16 dp
```

---

## Shared Chrome (all three steps)

```
┌──────────────────────────────────────────┐  y=0
│  ← [back]      ①──②──③       [skip?]   │  56dp      wizard header
├──────────────────────────────────────────┤  y=56
│                                          │
│           STEP CONTENT AREA              │  512dp     changes per step
│                                          │
├──────────────────────────────────────────┤  y=568
│  ╭──────────────────────────────────────╮│
│  │         CONTINUE  →                  ││  56dp      sticky CTA
│  ╰──────────────────────────────────────╯│
└──────────────────────────────────────────┘  y=624  (+16dp nav pad)
```

### Shared Header Components

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Back button | 48 × 48 | 4, 4 | Navigates to previous step; Step 1 → Main Menu |
| Step indicator | 120 × 20 | center x, 18 | Three dots connected by lines; active dot `$accent-genesis` 16dp, inactive `$bg-elevated` 10dp |
| Step label | 120 × 14 | center x, 36 | `$t-micro` `$text-muted`; "MODE · TEAM · ITEMS" |
| CONTINUE button | 328 × 56 | 16, 568 | `PrimaryButton`; disabled (`$bg-elevated` + `$text-muted`) until step is valid |

---

## Step 1 — Mode Select

```
├──────────────────────────────────────────┤  y=56
│                                          │
│   SELECT A MODE                          │  32dp  section title
│                                          │
│  ┌──────────────────────────────────────┐│
│  │  ▶  Story Mode                       ││  88dp  mode card
│  │     Follow the Genesis narrative     ││
│  │     Single-player · Unlimited time   ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │  ⚔  Ranked                           ││  88dp
│  │     Compete on the global leaderboard││
│  │     PvP  ·  Best of 3  ·  500 Ticks  ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │  🎲  Draft Mode          [COMING]    ││  88dp
│  │     In-combat unit draft              ││
│  └──────────────────────────────────────┘│
│        (scrollable if more modes)        │
└──────────────────────────────────────────┘
```

### Mode Card

| Component | Size (dp) | Properties |
|---|---|---|
| Card bg | 328 × 88 | `$bg-card` `$r-md`; selected: `$accent-genesis` border 2dp |
| Mode icon | 40 × 40 | Left-aligned, 16dp from edges; icon colour `$accent-genesis` |
| Mode name | 240 × 20 | `$t-subheading` `$text-primary` |
| Description | 240 × 16 | `$t-label` `$text-secondary`, 1 line |
| Meta tags | 240 × 14 | `$t-micro` `$text-muted`; dot-separated |
| Coming soon badge | 72 × 20 | `$r-sm` `$bg-elevated`; "COMING SOON" `$t-micro` `$text-muted` |

---

## Step 2 — Team Compose

```
├──────────────────────────────────────────┤  y=56
│  SELECT YOUR TEAM   (mode max: 3 units)  │  32dp
├──────────────────────────────────────────┤  y=88
│ ┌────────┐  ┌────────┐  ┌────────┐       │
│ │[slot 1]│  │[slot 2]│  │[slot 3]│       │  96dp  selected team row
│ │  name  │  │  name  │  │  + add │       │
│ └────────┘  └────────┘  └────────┘       │
├──────────────────────────────────────────┤  y=184
│ [All][Hunter][Ranger]…  filter tabs      │  40dp
├──────────────────────────────────────────┤  y=224
│  ┌──────────────┐  ┌──────────────┐      │
│  │  [portrait]  │  │  [portrait]  │      │  128dp  card row 1
│  │  Iron Warden │  │  Swift Veil  │      │
│  │  ★★★         │  │  ★★          │      │
│  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐      │  128dp  card row 2
│         (scrollable grid)                │
└──────────────────────────────────────────┘
```

### Team Slot (selected unit)

| Component | Size (dp) | Properties |
|---|---|---|
| Slot bg | 96 × 88 | `$bg-card` `$r-md`; empty: dashed `$bg-elevated` border |
| Portrait | 64 × 64 | `UnitPortrait md`; centered; tap to remove unit |
| Name | 88 × 14 | `$t-micro` `$text-secondary`; centered; truncate |
| Remove badge | 20 × 20 | `×` icon `$r-pill` `$accent-danger`; top-right corner |
| Empty state | — | `+` icon 32dp `$text-muted`; "Add Unit" `$t-micro` |

### Roster Cards in Step 2

Same as `03_roster.md` card but:
- Already-selected cards show a checkmark overlay `$accent-genesis`
- Full-team state: unselected cards dim 50%

---

## Step 3 — Genesis Items

```
├──────────────────────────────────────────┤  y=56
│  EQUIP GENESIS ITEMS                     │  32dp  section title
│  (items persist across all battles)      │
├──────────────────────────────────────────┤  y=88
│  ┌────────────────────────────────────┐  │
│  │ [port 48dp] Iron Warden            │  │  72dp  unit row (per team member)
│  │  Slot A: [Relic ▼]  Slot B: [——]  │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │  72dp  unit row
│  │ [port 48dp] Swift Veil             │  │
│  │  Slot A: [——]  Slot B: [——]        │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤  y=304  (item picker slides up)
│                                          │
│        (summary / confirm zone)          │  264dp
│                                          │
└──────────────────────────────────────────┘
```

### Unit Item Row

| Component | Size (dp) | Properties |
|---|---|---|
| Row bg | 328 × 72 | `$bg-card` `$r-md` |
| Portrait | 48 × 48 | `UnitPortrait sm`; left edge 12dp |
| Unit name | 200 × 18 | `$t-subheading`; 8dp right of portrait |
| Item slot button | 120 × 36 | `$r-md` `$bg-elevated`; "[Item Name ▼]" or "[— Empty —]"; tapping opens Item Picker sheet |

### Item Picker Bottom Sheet (slides up 320dp)

```
├──────────────────────────────────────────┤  y=320 (sheet top)
│  ▬  CHOOSE ITEM FOR SLOT A              │  48dp  drag handle + title
├──────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  │
│  │ [icon]  Relic  │  │ [icon]  Ring   │  │  item cards (2-col)
│  │  +10% Boosted  │  │  +5 AP regen   │  │  80dp each
│  └────────────────┘  └────────────────┘  │
│  (scrollable)                            │
│                                          │
│  ╭────────────────────────────────────╮  │
│  │              EQUIP                 │  │  56dp
│  ╰────────────────────────────────────╯  │
└──────────────────────────────────────────┘
```

---

## States

| State | Description |
|---|---|
| Step 1 — none selected | CONTINUE disabled |
| Step 1 — mode selected | CONTINUE enabled; selected card highlighted |
| Step 2 — 0 units | CONTINUE disabled; team slots show empty state |
| Step 2 — ≥1 unit | CONTINUE enabled |
| Step 3 — 0 units | START BATTLE disabled (`canContinue` requires `selectedTeam.length ≥ 1`) |
| Step 3 — ≥1 unit | START BATTLE enabled |
| Step 3 — picker open | Bottom sheet overlays; background dims |

### Battle entry guard

`PreBattleContext.canContinue` enforces team selection at every step:
- Step 0: mode selected
- Step 1: ≥1 character selected
- Step 2 (START BATTLE): ≥1 character selected

On CONTINUE from Step 2, `setSelectedTeamIds(selectedTeam.map(c => c.id))` writes
the selection to the global Zustand store before navigating to Battle.

If a player navigates directly to `/battle` with no team (via URL or stale deep link),
`BattleProvider` detects `selectedTeamIds.length === 0`, sets `isLoading = false`
with `playerUnit = null`, and `BattleScreen` redirects silently to Pre-Battle.

---

## Interactions

| Action | Result |
|---|---|
| Tap mode card (Step 1) | Select mode; enable CONTINUE |
| Tap CONTINUE | Advance to next step |
| Tap back | Return to previous step |
| Tap unit card (Step 2) | Toggle unit in team |
| Tap item slot (Step 3) | Open Item Picker sheet |
| Tap item in picker | Select item |
| Tap EQUIP in picker | Confirm item, close sheet |
| Swipe picker down | Dismiss without equipping |
