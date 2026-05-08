# Stat Guidelines

Design reference for setting character stats. All values are baselines —
final numbers are hand-tuned per character within these bounds.

---

## HP Ranges by Class

HP is a standalone design value, not derived from any stat.
Endurance governs physical durability and mitigation — it is not a HP multiplier.

| Class | HP Range | Notes |
|---|---|---|
| Warrior | 440 – 680 | Frontline melee; high Strength and Endurance |
| Caster | 280 – 510 | Ability-driven; survives at range, fragile up close |
| Hunter | 290 – 480 | Mobile; needs enough HP to survive skirmish range |
| Guardian | 560 – 820 | Defensive anchor; always the tankiest class at any rarity tier |
| Ranger | 320 – 510 | Ranged precision; shares backline positioning with Caster |
| Enchanter | 280 – 440 | Squishiest class; must stay protected to contribute |

Custom classes (e.g. Material Engineer) map to the closest archetype for HP reference.

### Rarity scaling within a range

Low rarity characters sit near the floor; high rarity near the ceiling.
Approximate breakpoints across 7 tiers (Normal → OMEGA):

| Rarity | Position in range |
|---|---|
| 1 – Normal | Floor |
| 2 – Advance | ~15% up |
| 3 – Super | ~30% up |
| 4 – Epic | ~50% up |
| 5 – Master | ~65% up |
| 6 – Legend | ~80% up |
| 7 – OMEGA | Ceiling |

**Example — Caster (280–510, spread 230):**
- Rarity 3 (Super): 280 + 230 × 0.30 ≈ 349 → round to nearest 5 or 10

---

## Damage calibration reference

Use these as a sanity check when setting HP:

| Hit type | Target % of recipient HP |
|---|---|
| Basic attack | 6 – 10% |
| Standard skill | 12 – 20% |
| Hard-hitting skill (high cost / cooldown) | 20 – 30% |
| Max-charge / ultimate-style skill | 30 – 40% |

A unit should survive 3–4 hard hits before going down.
A basic attack chain alone should never be the primary kill path.

---

## Existing characters

| Character | Class | Rarity | HP |
|---|---|---|---|
| Hugo Rekrot | Material Engineer (≈ Warrior) | 4 – Epic | 500 |
| Husty | Caster | 3 – Super | 336 |
