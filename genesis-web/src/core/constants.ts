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
  Boosted:  0.10,
  Success:  0.40,
  Tumbling: 0.10,
  GuardUp:  0.20,
  Evasion:  0.10,
  Fail:     0.10,
} as const

export const BOOSTED_MULTIPLIER  = 1.5    // damage × 1.5 on Boosted
export const TUMBLING_MULTIPLIER = 0.5    // damage × 0.5 on Tumbling
export const GUARD_UP_MITIGATION = 0.10   // 10% of raw output becomes mitigation

// Tumbling outcome delays the attacker by 1–5 ticks
export const TUMBLING_DELAY_MIN = 1
export const TUMBLING_DELAY_MAX = 5

// Counter chain — diminishing probability per recursion depth
export const COUNTER_BASE            = 0.15  // 15% at depth 0
export const COUNTER_STEP            = 0.02  // drops 2% per depth
export const COUNTER_MIN             = 0.01  // never below 1%
export const COUNTER_ANNOUNCE_MS     = 800   // pause before counter dice roll is displayed
export const AI_COUNTER_AP_RESERVE   = 20    // enemy skips counter if remaining AP after cost < this

// Tick collision — occupancy cap + QTE parameters
export const TICK_MAX_OCCUPANCY        = 4      // units per tick before D8 displacement triggers
export const QTE_KNOB_RPM              = 90     // spinning knob rotations per minute (1.5 rps)
export const QTE_TARGET_ZONE_DEG       = 60     // target arc width in degrees
export const QTE_ROUNDS                = 3      // tap rounds each participant gets
export const QTE_BAR_FILL_PER_HIT      = 0.18  // bar shift per successful tap
export const QTE_BAR_ALLY_WEIGHT_BONUS = 0.05  // extra shift per additional same-team unit on the tick
export const AI_QTE_ACCURACY           = 0.65  // probability AI lands in target zone
export const QTE_AI_TAP_DELAY_MS       = 1200  // ms before AI taps each round

// Unit limits
export const MAX_SKILL_SLOTS = 4
export const TEAM_SIZE_MAX   = 2

// Timeline visual settings
export const TIMELINE_PX_PER_TICK      = 10    // pixels per tick unit on the strip
export const TIMELINE_BUFFER_TICKS     = 15    // extra ticks beyond the outermost registered unit
export const TIMELINE_OVERLAY_PX       = 24    // dead-zone overlay height at each strip edge (1.5rem @ 16px base — must match CSS)
export const TIMELINE_FUTURE_RANGE     = 300   // ticks always kept visible ahead of the current tick
export const TIMELINE_NOW_FRACTION     = 0.75  // now-line sits at 75% from the strip top
export const TIMELINE_RECENTER_DELAY_MS  = 1500 // ms of scroll-idle before auto-recenter fires
export const TURN_DISPLAY_DISMISS_MS     = 2000 // ms after action resolves before turn panel auto-clears
export const DICE_RESULT_DISMISS_MS      = 4000 // ms dice outcome burst is visible (matches 4s animation)
export const CLASH_ANNOUNCE_MS           = 1500 // ms clash-winner log is shown before phase advances
export const ENEMY_AI_DELAY_MS           = 2000 // ms between telegraph and enemy action firing
export const BACK_DEBOUNCE_MS            = 300  // min ms between back-button presses in battle
export const BATTLE_FEEDBACK_HOLD_MS     = 500  // ms to hold after attack animation before applying state
export const BETWEEN_TURN_PAUSE_MS       = 150  // pause between unit exit and next unit entrance

// Input timing thresholds (milliseconds / px)
export const HOVER_THROTTLE_MS         = 100
export const LONG_PRESS_DURATION_MS    = 500
export const SWIPE_MIN_DISTANCE_PX     = 50
export const DOUBLE_TAP_WINDOW_MS      = 300
export const SCROLL_DETECT_THRESHOLD_PX = 8  // if scrolled >8px, treat as scroll, not tap

// Narrative layer — dialogue box + animation timings
export const NARRATIVE_DISMISS_MS    = 3500  // ms before dialogue box auto-dismisses
export const NARRATIVE_TYPEWRITER_MS = 30    // ms per character typewriter effect
export const NARRATIVE_FLASH_MS      = 600   // screen-flash animation duration
export const NARRATIVE_FLY_MS        = 350   // portrait fly-in animation duration
export const NARRATIVE_FLOAT_MS      = 1200  // floating-text rise + fade duration

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
