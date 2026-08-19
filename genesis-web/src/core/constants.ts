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
  Boosted: 0.10,
  Hit:     0.40,
  Evade:   0.20,
  Fail:    0.30,
} as const

export const BOOSTED_MULTIPLIER = 1.5    // damage × 1.5 on Boosted


// Counter chain — diminishing probability per recursion depth
export const COUNTER_BASE            = 0.15  // 15% at depth 0
export const COUNTER_STEP            = 0.02  // drops 2% per depth
export const COUNTER_MIN             = 0.01  // never below 1%
export const COUNTER_ANNOUNCE_MS     = 800   // pause before counter dice roll is displayed
export const AI_COUNTER_AP_RESERVE   = 20    // enemy skips counter if remaining AP after cost < this
export const SKIP_TU_COST            = 10    // TU cost for Skip/End Turn action; overridable via status payload forcedSkipTuCost

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
export const DICE_RESULT_DISMISS_MS      = 1200 // ms from dice signal to attack fire: 800ms roll + 400ms hold; tap-to-skip cuts this short
export const CLASH_ANNOUNCE_MS           = 1500 // ms clash-winner log is shown before phase advances
export const AI_THINKING_MIN_MS          = 1500 // min ms AI "deliberates" before revealing target
export const AI_THINKING_MAX_MS          = 2000 // max ms AI "deliberates" before revealing target
export const AI_INPUT_MIN_MS             = 800  // min ms between target reveal and attack execution
export const AI_INPUT_MAX_MS             = 1600 // max ms between target reveal and attack execution
export const BACK_DEBOUNCE_MS            = 300  // min ms between back-button presses in battle
export const BATTLE_FEEDBACK_HOLD_MS     = 500  // ms to hold after attack animation before applying state
export const ANIM_TIMEOUT_MS             = 1500 // fixed engine wait after firing an attack/death animation (fire-and-forget model)
export const BETWEEN_TURN_PAUSE_MS       = 150  // pause between unit exit and next unit entrance
export const ANIM_FRAME_INTERVAL_MS      = 800  // default ms per animation frame (idle loops)

// Input timing thresholds (milliseconds / px)
export const HOVER_THROTTLE_MS         = 100
export const LONG_PRESS_DURATION_MS    = 500
export const SWIPE_MIN_DISTANCE_PX     = 50
export const DOUBLE_TAP_WINDOW_MS      = 300
export const SCROLL_DETECT_THRESHOLD_PX = 8  // if scrolled >8px, treat as scroll, not tap

// Resolution quality adapter
export const QUALITY_BENCHMARK_FRAMES    = 120    // frames sampled during startup FPS benchmark
export const QUALITY_HIGH_FPS_THRESHOLD  = 55     // ≥55 fps → High tier
export const QUALITY_MED_FPS_THRESHOLD   = 40     // ≥40 fps → Medium tier (else Low)
export const QUALITY_STEP_UP_FPS         = 58     // sustained fps required for live step-up
export const QUALITY_STEP_UP_CHECKS      = 10     // consecutive 1-s checks at ≥STEP_UP_FPS to trigger step-up

// Dungeon exploration
export const DUNGEON_DEFAULT_MOVE_RANGE    = 1    // tiles the party can move per turn
export const DUNGEON_DEFAULT_VISUAL_RANGE  = 1    // Chebyshev detection radius for entities
export const DUNGEON_REVEAL_RADIUS         = 2    // fog-of-war reveal radius around party
export const DUNGEON_MOVE_ANIM_MS          = 180  // ms per tile movement tween
export const DUNGEON_PATROL_ANIM_MS        = 200  // ms per tile for enemy patrol step
export const DUNGEON_WAVE_VIGNETTE_OPACITY = 0.65 // overlay opacity during wave phase
export const DUNGEON_ENCOUNTER_PAUSE_MS    = 350   // pause after patrols settle before encounter check fires
export const DUNGEON_SPOT_FLASH_MS         = 2000  // ms enemy shakes on-grid (spotted phase)
export const DUNGEON_ENCOUNTER_FLASH_MS    = 1000  // ms rapid white-flash overlay before navigating to battle
export const DUNGEON_ENCOUNTER_BANNER_MS   = 1200  // ms encounter telegraph banner (wave phase)

// Resource bar segmentation — HP/AP/XP fill draws as this many discrete
// blocks rather than a continuous width, so it "ticks down" instead of sliding.
export const RESOURCE_BAR_SEGMENT_COUNT      = 20    // blocks the fill divides into
export const RESOURCE_BAR_LOW_THRESHOLD      = 0.5   // HP fill shifts to flare-3 below this
export const RESOURCE_BAR_CRITICAL_THRESHOLD = 0.25  // HP fill shifts to blood-2 below this

// First-time hint toaster
export const HINT_TOASTER_DURATION_MS = 5000  // ms the hint stays visible before auto-dismiss

// Battle error toast
export const BATTLE_ERROR_TOAST_MS = 15000  // ms error toast is shown before auto-navigating away

// Insufficient-AP feedback
export const AP_WARN_SHAKE_MS   = 380   // shake animation duration on tapped AP-short button
export const AP_WARN_DISMISS_MS = 3000  // ms the insufficient-AP toast stays visible
export const HINT_STORAGE_PREFIX      = 'genesis-hint-'

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
