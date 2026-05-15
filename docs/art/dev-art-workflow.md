# Dev Art Workflow — Gemini Spritesheet Generation

This is the working process for generating character animation spritesheets during
development. The goal is placeholder-quality art that slots directly into the engine
without blocking development.

---

## Tool

Gemini (image generation). Reference images are provided alongside every prompt —
they carry the visual detail. Prompts stay minimal as a result.

---

## Spritesheet format

- Single row of frames per pass
- Transparent background
- No fixed frame limit — generate as many as useful; the developer cuts frames manually
- One animation state per generation pass

---

## Two-pass workflow (characters with a damaged variant)

Some characters have two visual states — base and damaged. Hugo is the current example:
ANBOT's nanite suit shows visible stress/wear in the damaged state.

**Pass 1 — base:**

Provide the base model reference image. Write a minimal prompt describing the pose
sequence for the animation state. The reference carries all character and costume detail.

**Pass 2 — damaged variant:**

Provide two inputs: the base row generated in Pass 1, and the damaged model reference
image. The prompt instructs Gemini to redraw the same sequence in the damaged model's
palette and visual state — same poses, same framing, damaged appearance only.

The base-first order locks poses before introducing the damaged visual delta. This
prevents frame misalignment when the engine switches between base and damaged variants
at runtime.

---

## Single-pass workflow (characters without a damaged variant)

Most characters have one visual state. Provide the character reference image and a
minimal pose-sequence prompt. One pass produces the usable spritesheet row.

---

## Prompt structure

Keep prompts short. The reference image is the primary visual instruction.

```
Reference image provided ([base model / damaged model / base row + damaged model]).
Generate a single row of [N] frames on a transparent background.

- Frame 1–N: [brief pose description per frame or frame range]
```

Do not describe the character's appearance, costume, or design in the prompt —
the reference image covers that. Only describe the motion.

---

## Animation states covered so far

| Character | State | Variant | Status |
|---|---|---|---|
| hugo_001 | `idle` | base + damaged | ✅ Done |
| hugo_001 | `hurt` | base + damaged | ✅ Done |
| hugo_001 | `dodge` | base + damaged | ✅ Done |
| hugo_001 | `dash` | base + damaged | ✅ Done |
| hugo_001 | `hugo_001_basic_attack` | base + damaged | ✅ Done |
| hugo_001 | `hugo_001_nanites_slash` | base + damaged | ✅ Generated |
| hugo_001 | `hugo_001_hammer_bash` | base + damaged | ✅ Generated |
| hugo_001 | `hugo_001_shelling_point` | base + damaged | ✅ Generated |
| hugo_001 | `hugo_001_hyper_sense` | base + damaged | ✅ Generated |
| hugo_001 | `hugo_001_hyper_sense_hyper` | damaged only | ✅ Generated |
| hugo_001 | `death` | base + damaged | ✅ Generated |

---

## Engine integration

Once frames are cut, drop them into:

```
public/images/characters/{defId}/{state_key}/
```

The engine reads frame paths from `animations.json` per character. No code change
required to add new frames — only the JSON manifest needs updating.

See `docs/mechanics/phaser-arena.md` for the full art upgrade path.
