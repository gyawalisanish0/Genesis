// Dungeon exploration constants. Split out of constants.ts, which kept
// exceeding the 150-line module limit. Re-exported from './constants'.

// Dungeon exploration
export const DUNGEON_DEFAULT_MOVE_RANGE    = 1    // tiles the party can move per turn
export const DUNGEON_DEFAULT_VISUAL_RANGE  = 1    // Chebyshev detection radius for entities
// Reveal radius and entity render range. At 2 an enemy first appeared on the
// same turn it detected the party. Shape: core/dungeon/sight.ts, not a square.
export const DUNGEON_REVEAL_RADIUS         = 3
export const DUNGEON_MOVE_ANIM_MS          = 180  // ms per tile movement tween
export const DUNGEON_PATROL_ANIM_MS        = 200  // ms per tile for enemy patrol step
export const DUNGEON_WAVE_VIGNETTE_OPACITY = 0.65 // overlay opacity during wave phase
export const DUNGEON_ENCOUNTER_PAUSE_MS    = 350   // pause after patrols settle before encounter check fires
// Encounter transition, in two beats: enemy rears up with an alert marker, then
// the screen blows out to white. At 2000/1000 ms both read as stuck animations.
export const DUNGEON_SPOT_FLASH_MS         = 1100  // ms enemy alert pose before the flash
export const DUNGEON_ENCOUNTER_FLASH_MS    = 520   // ms white blow-out before battle
export const DUNGEON_ENCOUNTER_BANNER_MS   = 1200  // ms encounter telegraph banner (wave phase)
