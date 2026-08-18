# Pixel art assets

Sizes, palette discipline, manifest authoring, and export rules. Sizes come
from `docs/ui/00-design-system.md § 2` — this file is the authoring procedure.

---

## Sizes

Authored at **1× art pixels**. Rendered at exactly 2×.

| Asset | Art px | Rendered dp | Path |
|---|---|---|---|
| Battle sprite | 48 × 48 | 96 × 96 | `images/characters/{defId}/{state}/{n}.png` |
| Battle sprite (boss) | 64 × 64 | 128 × 128 | same |
| Portrait | 32 × 32 | 64 × 64 | `images/characters/{defId}/portrait.png` |
| Status icon | 16 × 16 | 32 × 32 | `images/characters/{defId}/UI/Status/{key}.png` |
| Dungeon tile | 24 × 24 | 48 × 48 | `images/tilesets/{key}/{art}.png` |
| Dungeon entity | 16 × 16 | 32 × 32 | `images/tilesets/{key}/…` |

Frame files are **0-indexed** (`0.png`, `1.png`, …) and the folder name must
match the `animations` key in the manifest.

---

## Palette discipline

Index every asset to the ramps in `docs/ui/00-design-system.md § 3`. Shading
picks a neighbouring ramp step — never a newly mixed value.

- A sprite should use ~4–6 colours plus transparency. If it needs more, the
  design is too detailed for 48 px; simplify the silhouette instead.
- Silhouette reads first. At 48 px a character is recognised by outline, not
  by facial detail — spend the pixels on shape, stance, and weapon.
- Faction tinting rides the ramp: allies bias `moss`/`cyan`, Netrolume `rust`,
  Kiragen `void`. Keep hue families consistent so the player can read
  allegiance at a glance in a 96 dp sprite.
- Anti-aliased edges are a bug. If generated art has them, re-index and
  hard-threshold the alpha before it enters the repo.

---

## Generated art

`docs/art/dev-art-workflow.md` covers the generation process. Generated output
essentially never satisfies the grid directly. Before committing:

1. Downsample to the exact art-px size (nearest neighbour, never bilinear).
2. Re-index to the ramp palette.
3. Hard-threshold alpha — no partial transparency.
4. Confirm the frame count matches the manifest.

Placeholder quality is fine; off-grid is not. An off-grid asset looks broken
in a way a crude on-grid one does not.

---

## Manifests

Two JSON files per character, both optional, both Zod-validated.

**`animations.json`** — `AnimationManifest`. The sprite contract:
display dimensions, per-state frame counts and rates, aura config, projectile.

```jsonc
{
  "type": "animations",
  "defId": "hugo_001",
  "display": { "sourceWidth": 48, "sourceHeight": 48,
               "scale": 1, "anchorX": 0.5, "anchorY": 1.0 },
  "idleSwapBelowHpPercent": 0.4,   // swaps to *_damaged states below this
  "meleeDashDx": 80,
  "tagMap": {},
  "animations": {
    "idle":   { "frames": 2, "frameRate": 1.25, "repeat": -1 },  // -1 loops
    "attack": { "frames": 3, "frameRate": 12,   "repeat": 0 },   //  0 once
    "skills": { "hugo_001_hammer_bash": { "frames": 4, "frameRate": 10, "repeat": 0 } }
  },
  "projectile": null
}
```

Every state needs a `*_damaged` counterpart if the character has a damaged
look, or the engine falls back and the swap silently does nothing.

**`anim_sequence.json`** — `AnimSequenceManifest`, keyed by skill id or
sequence id, valued as `AnimPhase[]`. This is per-skill choreography:
`wait`, `playAnim`, `shove`, `flash`, `particles`, `impact`, `damageNumber`,
`statusText`, `cameraShake`, `aura`, `parallel`, `branch`.

Sequences also cover status activation/expiry via `StatusDef.activateSequenceId`
and `expireSequenceId`.

---

## Validation

```
npm run validate:data     # also runs automatically on npm run build
```

Both manifests are schema-checked (`animationManifestSchema`,
`animSequenceManifestSchema` in `src/core/schemas.ts`). Schemas are **strict**
— an unknown key fails the build. Adding a field means adding it to the schema
and the TS type in the same change.

Missing manifests are fine — loaders return `null` and the engine falls back.
Malformed ones are not.
