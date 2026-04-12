import type { AppSettings } from './types'

// Starting tick range per class — [min, max]
// Higher Speed compresses the random ceiling toward class_min.
export const CLASS_TICK_RANGES: Readonly<Record<string, [number, number]>> = {
  Hunter:    [1,  6],
  Ranger:    [3,  9],
  Caster:    [5,  12],
  Warrior:   [6,  14],
  Enchanter: [7,  15],
  Guardian:  [10, 20],
}

// Base outcome probabilities at 100% final hit chance
export const DICE_BASE_PROBABILITIES = {
  Boosted:  0.15,
  Success:  0.45,
  Tumbling: 0.10,
  GuardUp:  0.20,
  Evasion:  0.10,
} as const

export const BOOSTED_MULTIPLIER  = 1.5    // damage × 1.5 on Boosted
export const TUMBLING_MULTIPLIER = 0.5    // damage × 0.5 on Tumbling
export const GUARD_UP_MITIGATION = 0.10   // 10% of raw output becomes mitigation

// Tumbling outcome delays the attacker by 1–5 ticks
export const TUMBLING_DELAY_MIN = 1
export const TUMBLING_DELAY_MAX = 5

// Evasion counter chain — diminishing probability per recursion depth
export const EVASION_COUNTER_BASE = 0.15  // 15% at depth 0
export const EVASION_COUNTER_STEP = 0.05  // drops 5% per depth
export const EVASION_COUNTER_MIN  = 0.01  // never below 1%

// Unit limits
export const MAX_SKILL_SLOTS = 4
export const TEAM_SIZE_MAX   = 2

// Input timing thresholds (milliseconds / px)
export const HOVER_THROTTLE_MS         = 100
export const LONG_PRESS_DURATION_MS    = 500
export const SWIPE_MIN_DISTANCE_PX     = 50
export const DOUBLE_TAP_WINDOW_MS      = 300
export const SCROLL_DETECT_THRESHOLD_PX = 8  // if scrolled >8px, treat as scroll, not tap

// Default app settings
export const DEFAULT_SETTINGS: AppSettings = {
  musicVolume:       0.75,
  sfxVolume:         0.80,
  muteAll:           false,
  reduceAnimations:  false,
  showDamageNumbers: true,
  timelineZoom:      5,
  battleReminders:   false,
  newContentAlerts:  true,
}
