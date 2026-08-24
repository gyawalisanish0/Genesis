# UI Documentation

Three files, read in order. Each layer builds on the one before it.

| File | Covers |
|---|---|
| [`00-design-system.md`](./00-design-system.md) | Canvas, **pixel grid**, palette ramps, typography, spacing, panels, motion, asset pipeline |
| [`01-components.md`](./01-components.md) | Every reusable component — anatomy, props, states — plus the consolidation plan |
| [`02-screens.md`](./02-screens.md) | Per-screen composition and interaction, navigation map |

**Art direction: GBA-era pixel art.** The rationale is in
[`../design/design-philosophy.md`](../design/design-philosophy.md); the
enforceable rules are in `00-design-system.md § 2`.

## Boundaries

These files describe the **UI layer only**. They deliberately do not repeat:

| Topic | Lives in |
|---|---|
| Routing, safe-area modes, back-button contracts | `CLAUDE.md` § Screen System |
| Fullscreen delivery paths | `CLAUDE.md` § Display & Full-Screen Rules |
| Scroll-aware pointer rules | `CLAUDE.md` § Input Handling |
| Combat mechanics (ticks, clash, counter, cooldown) | `docs/mechanics/` |
| Content JSON schemas | `docs/engine/00_content_contract.md` |

## History

This set replaces fourteen previous `docs/ui/*.md` files (~3,600 lines) that
had drifted from the implementation — most visibly, the old design system
specified a purple palette the code never shipped. `ascii-character-art.md` and
`battle-symbol-ui.md` were deleted outright when the ASCII render layer was
removed.
