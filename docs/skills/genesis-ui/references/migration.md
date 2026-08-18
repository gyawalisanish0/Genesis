# Migration — current code → documented target

`docs/ui/01-components.md` describes the target. This file records what
actually exists today and the order to converge them.

Convert **incrementally**: when a task touches a screen, migrate that screen's
share of the current step. Do not attempt a big-bang rewrite — the battle
screen alone is 800 lines and every conversion risks the engine contract.

---

## Current → target

| Exists today | Becomes | Notes |
|---|---|---|
| `PrimaryButton` | `PixelButton` | Same variants; swap surface to `Panel variant="raised"`, drop radii. |
| `SkillInfoOverlay`, `StatusInfoOverlay`, `ChestOverlay`, `BattleLogOverlay` | `Sheet` + content | Six `.backdrop` rules today. Sheet owns backdrop, rise/drop, back-button. |
| `TeamCollisionOverlay`, `ClashQteOverlay` | `PromptOverlay` + content | Both are "battle halts → player chooses → resumes". Keep bodies, share chrome. |
| `HintToaster`, `ErrorToaster`, `BattleErrorToast` | `Toaster` (3 tones) | First two already share a stylesheet. `fatal` keeps the blocking behaviour. |
| Battle screen's own portrait circle | `UnitPortrait size="lg"` | Already swapped; the bespoke circle CSS can go once glow moves onto the component. |
| `ResourceBar` continuous fill | segmented fill | Blocked 2 art px segments, `steps(16)` tween. |
| `--r-sm` … `--r-xl` in `tokens.css` | deleted | Blocked on `Panel` existing. `--r-pill` stays. |
| flat hex in `tokens.css` | ramp steps | Add ramps first, repoint semantic tokens, leave names unchanged. |
| `--font-sans` only | `--font-pixel` + `--font-sans` | Chrome uses pixel; prose (descriptions, log) stays sans. |

Already done: ASCII render layer removed; `SpriteArena` owns
`BattleArenaHandle`; `UnitPortrait` renders `portrait.png`; tiles fill from
`TilesetDef.tiles[id].color`.

---

## Order

Dependency-driven. Each step should end with `npm run validate:ui:baseline`
so the ratchet tightens.

1. **Tokens** — add the ten ramps, repoint every semantic token at a ramp
   step, add `--font-pixel`. Nothing else can be correct until colour is
   token-only. No component changes yet; purely additive plus repointing.
2. **`Panel`** — the nine-slice box. Everything visual composes from it.
   Ship it with the five variants before converting any consumer.
3. **`PixelButton`** — replaces `PrimaryButton`. Mechanical: same props, new
   surface. Migrate all call sites in one pass; there are few.
4. **`Sheet`** — collapses four overlays. Biggest single baseline reduction.
   Convert one overlay at a time, verifying the back-button contract each time.
5. **`PromptOverlay`** — collapses the two battle decision overlays. Touches
   engine-blocking behaviour, so do it after `Sheet` has proven the pattern.
6. **`Toaster`** — collapses three toasts. `fatal` tone must preserve
   `BattleErrorToast`'s auto-navigate.
7. **`ResourceBar` segmentation** — visual only, no API change.
8. **Retire radii** — delete `--r-sm`…`--r-xl` once no consumer references
   them. This is what finally drives `no-border-radius` to zero.
9. **Per-screen sweep** — remaining hardcoded colours, gradients, and the
   oversized modules (`BattleScreen` 805, `BattleContext` 668,
   `DungeonContext` 527 lines).

Steps 1–2 unblock everything; do them first even if the immediate task is
elsewhere. Steps 3–7 are independent of each other and can be taken in any
order as tasks touch those areas.

---

## Rules while migrating

- **Never** write against a primitive that doesn't exist yet. If the task
  needs `Sheet` and `Sheet` isn't built, either build it (step 4) or follow
  the current pattern and leave a note — do not invent a third pattern.
- Keep the engine contract intact. `BattleArenaHandle`, `DungeonArenaHandle`,
  and `BattleEngineCallbacks` are driven by `core/`; UI changes must not
  alter their shapes. Full battle suite (`npx vitest run`) must stay green.
- Overlays register back-button handlers. When collapsing them into `Sheet`,
  verify pause/resume in battle still cannot be escaped by the back button —
  only LEAVE BATTLE exits (CLAUDE.md § Input Handling).
- A migration that reduces violations **must** be followed by
  `npm run validate:ui:baseline`, or the stale-baseline check fails.
