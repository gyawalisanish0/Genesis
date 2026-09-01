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

// ── Two-phase resolution ──────────────────────────────────────────────────
// CONCEPT.md § Skill Resolution. Phase 1 is the actor's strike quality; phase 2
// is the target's reaction to it. Neither phase alone decides the outcome.

/** Phase 1, at strikeChance 1.0. None of these is a miss. */
export const STRIKE_BASE_PROBABILITIES = {
  Clean: 0.20,
  Solid: 0.50,
  Loose: 0.30,
} as const

/**
 * Phase 2, at reactionChance 1.0, keyed by the strike being reacted to.
 *
 * This is the whole reason strike quality matters: a Clean blow leaves almost
 * nothing to read, a Loose one leaves a wide window. The attacker plays for
 * Clean to *close the defender's options*, not to hit harder.
 */
export const REACTION_BASE_TABLES = {
  Clean: { Read: 0.05, Deflect: 0.35, Caught: 0.60 },
  Solid: { Read: 0.20, Deflect: 0.30, Caught: 0.50 },
  Loose: { Read: 0.40, Deflect: 0.35, Caught: 0.25 },
} as const

/** Endurance that leaves the reaction table unchanged. The shipped roster's
 *  mean Endurance is exactly this, so the baseline is measured, not chosen. */
export const REACTION_BASELINE_ENDURANCE = 50

/** Precision that leaves the strike table unchanged. */
export const STRIKE_BASELINE_PRECISION = 50

export const BOOSTED_MULTIPLIER = 1.5    // damage × 1.5 on Boosted

// A Graze delivers a quarter rather than whiffing. Under the old single-roll
// table 30% of every action produced literally nothing, and because the roll
// happens after the cost is committed, the most expensive skills were punished
// hardest — the opposite of the risk/reward a 50 AP skill should carry.
export const GRAZE_CHIP_MULTIPLIER = 0.25

// …and it refunds most of its AP. A partial result costs the tick, which is the
// currency this game is actually about; it should not also erase the bank.
export const GRAZE_AP_REFUND = 0.8

// The dice must never switch off. Both strikeChance and reactionChance are
// unbounded, so without a floor a Precision-100 attacker could not be read and
// an Endurance-100 defender could not be touched — the resolution system
// silently stops applying at one end of a stat. Every pool in both phases keeps
// this floor, so every roll stays a roll.
export const MIN_OUTCOME_POOL = 0.05

// Tick investment buys accuracy. TU is the currency this game is about, and it
// had no relationship to whether an action landed: a 5 TU jab and a 23 TU
// wind-up rolled identically. Committing more of the timeline to a swing now
// makes it more likely to connect, which turns the dice from a flat tax into a
// dial the player operates through skill choice.
export const TU_ACCURACY_BASELINE = 10    // TU that neither helps nor hurts
export const TU_ACCURACY_PER_TICK = 0.02  // finalChance shift per TU either side


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
export const TIMELINE_STRIP_DP         = 48    // strip width; fits token + occupancy + intent badge
export const TICK_TOKEN_DP             = 24    // unit marker diameter on the stream
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

// ── Re-exports ───────────────────────────────────────────────────────────────
// Split for the module-line limit; every consumer still imports from
// './constants' so the seam is invisible outside this directory.
export * from './constants.dungeon'
export * from './constants.presentation'
