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
| ~~`PrimaryButton`~~ | **`PixelButton`** ✅ | Done. Had one call site (`ChestOverlay`); `PrimaryButton` deleted. |
| ~~`SkillInfoOverlay`, `StatusInfoOverlay`, `ChestOverlay`, `BattleLogOverlay`~~ | **`Sheet` + content** ✅ | Done. All four now wrap `Sheet`; their bespoke backdrop/card/animation/close CSS is gone. `Sheet` gained `placement: bottom\|centre` and `accent`; back button stays a screen concern (see below). |
| `TeamCollisionOverlay`, `ClashQteOverlay` | `PromptOverlay` + content | Both are "battle halts → player chooses → resumes". Keep bodies, share chrome. |
| `HintToaster`, `ErrorToaster`, `BattleErrorToast` | `Toaster` (3 tones) | First two already share a stylesheet. `fatal` keeps the blocking behaviour. |
| Battle screen's own portrait circle | `UnitPortrait size="lg"` | Already swapped; the bespoke circle CSS can go once glow moves onto the component. |
| `ResourceBar` continuous fill | segmented fill | Blocked 2 art px segments, `steps(16)` tween. |
| `--r-sm` … `--r-xl` in `tokens.css` | deleted | Blocked on `Panel` existing. `--r-pill` stays. |
| ~~flat hex in `tokens.css`~~ | **ramp steps** ✅ | Done. Ten ramps added; every semantic token repointed; names unchanged. |
| ~~`--font-sans` only~~ | **`--font-pixel` + `--font-sans`** ✅ | Done. Neither face is bundled yet — both degrade to system stacks. |

Already done: ASCII render layer removed; `SpriteArena` owns
`BattleArenaHandle`; `UnitPortrait` renders `portrait.png`; tiles fill from
`TilesetDef.tiles[id].color`. **Steps 1–4 below are complete** — ramps and
`--font-pixel` shipped; `Panel` exists with all five variants; `PixelButton`
replaced `PrimaryButton`; `Sheet` replaced the four overlays. `--px` (1 art
pixel = 2 dp) was added so grid multiples are expressible. `reduceAnimations`
is now mirrored to the root element so the stepped-motion tokens actually
collapse.

---

## Order

Dependency-driven. Each step should end with `npm run validate:ui:baseline`
so the ratchet tightens.

1. ~~**Tokens**~~ ✅ — add the ten ramps, repoint every semantic token at a ramp
   step, add `--font-pixel`. Nothing else can be correct until colour is
   token-only. No component changes yet; purely additive plus repointing.
2. ~~**`Panel`**~~ ✅ — the nine-slice box. Everything visual composes from it.
   Ship it with the five variants before converting any consumer.
3. ~~**`PixelButton`**~~ ✅ — replaces `PrimaryButton`. Mechanical: same props, new
   surface. Migrate all call sites in one pass; there are few.
4. ~~**`Sheet`**~~ ✅ — collapsed all four overlays (skill/status/log/chest).
   Key finding: `backButtonRegistry` holds one handler at a time, so `Sheet`
   must NOT self-register — `BattleScreen`'s single `useBackButton` still owns
   the priority chain (skill → chip → log → pause). `Sheet` is presentational;
   the screen wires hardware-back to `onClose`.
5. **`PromptOverlay`** — collapses the two battle decision overlays
   (`TeamCollisionOverlay`, `ClashQteOverlay`). **This is the next step.**
   Touches engine-blocking behaviour; the `Sheet` pattern (presentational,
   screen owns back) is the template. `dismissible={false}` is the closest
   `Sheet` analogue, but a prompt needs an `actions` row — see the catalogue.
6. **`Toaster`** — collapses three toasts. `fatal` tone must preserve
   `BattleErrorToast`'s auto-navigate.
7. **`ResourceBar` segmentation** — visual only, no API change.
8. **Retire radii** — delete `--r-sm`…`--r-xl` once no consumer references
   them. This is what finally drives `no-border-radius` to zero.
9. **Per-screen sweep** — remaining hardcoded colours, gradients, and the
   oversized modules (`BattleScreen` 805, `BattleContext` 668,
   `DungeonContext` 527 lines).

Steps 1–4 are complete. **Step 5 (`PromptOverlay`) is next.** Steps 6–7 are
independent of each other and can be taken in any order as tasks touch those
areas.

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
