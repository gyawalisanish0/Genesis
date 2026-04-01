# Screen: Splash / Loading

## Purpose

First frame the player sees on cold launch. Loads all JSON definitions via
`DataService.load_all()` in the background while displaying the logo and a
progress indicator. Transitions automatically to Main Menu on completion.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry** | App cold start only |
| **Exit** | Auto → Main Menu (on load complete) |

---

## Dimensions

```
Canvas : 360 × 640 dp
Layout : full-bleed (no safe-zone insets — logo-only screen)
```

---

## Layout Schematic

```
┌──────────────────────────────────────────┐  y=0
│                                          │
│                                          │
│                                          │
│                                          │  200dp  top space
│                                          │
│                                          │
│                                          │
├──────────────────────────────────────────┤  y=200
│                                          │
│          ╔══════════════╗                │
│          ║   [LOGO]     ║  120 × 120 dp  │  120dp
│          ╚══════════════╝                │
│                                          │
├──────────────────────────────────────────┤  y=320
│                                          │
│           G E N E S I S                  │  36sp display  48dp
│                                          │
├──────────────────────────────────────────┤  y=368
│         ─────────────────               │
│              tagline                     │  48dp  ($t-body, $text-secondary)
│         ─────────────────               │
├──────────────────────────────────────────┤  y=416
│                                          │
│                                          │  128dp  breathing room
│                                          │
│                                          │
├──────────────────────────────────────────┤  y=544
│  [████████████░░░░░░░]  Loading…    n%  │  32dp  progress bar zone
│                                          │
├──────────────────────────────────────────┤  y=576
│         version  0.1.0                   │  64dp  footer
│           © Genesis                      │
└──────────────────────────────────────────┘  y=640
```

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Top space | 0 | 200 dp | Empty — particle / star field background animation |
| Logo mark | 200 | 120 dp | App icon / animated logomark, 120 × 120 dp centered |
| Title | 320 | 48 dp | "GENESIS" — `$t-display`, `$text-primary`, letter-spacing 8sp |
| Tagline | 368 | 48 dp | One-line logline — `$t-body`, `$text-secondary`, centered |
| Breathing room | 416 | 128 dp | Empty — animation continues behind |
| Progress | 544 | 32 dp | Loading bar + percentage label |
| Footer | 576 | 64 dp | Version string + copyright — `$t-micro`, `$text-muted` |

---

## Component Specifications

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Background | 360 × 640 | 0, 0 | `$bg-deep` fill; slow particle animation (stars drifting upward) |
| Logo mark | 120 × 120 | center x, y=200 | PNG / animated Lottie; subtle idle pulse (scale 1.0 → 1.04, 2 s loop) |
| Title label | 328 × 48 | 16, 320 | `$t-display`, `$text-primary`, centered, letter-spacing 8sp |
| Tagline label | 328 × 32 | 16, 368 | `$t-body`, `$text-secondary`, centered, max 1 line |
| Progress bar track | 200 × 8 | center x, y=556 | `$bg-elevated`, `$r-pill` |
| Progress bar fill | dynamic × 8 | 80, 556 | `$accent-genesis` fill, width animated; `$r-pill` |
| Progress label | 48 × 16 | 288, 552 | `$t-micro`, `$text-secondary`, right-aligned "Loading… n%" |
| Version label | 328 × 16 | 16, 596 | `$t-micro`, `$text-muted`, centered |

---

## States

| State | Description |
|---|---|
| Loading | Progress bar animating; no touch interaction |
| Complete | Bar hits 100%, 300 ms pause, then screen fades out to Main Menu |
| Error | Progress bar stops; brief error message replaces tagline (`$accent-danger`); retry hint shown |

---

## Animations

| Element | Animation | Duration |
|---|---|---|
| Logo mark | Scale pulse 1.0 → 1.04 → 1.0 | 2 s loop |
| Background | Particle drift (stars move upward at 8 dp/s) | Continuous |
| Progress fill | Width tween to match load percentage | 400 ms ease-out per update |
| Screen exit | Full-screen fade to black then crossfade to Main Menu | 500 ms total |
