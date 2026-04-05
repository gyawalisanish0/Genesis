# Starting tick range per class (min, max)
# Higher Speed compresses the random ceiling toward class_min
CLASS_TICK_RANGES = {
    "Hunter":    (1,  6),
    "Ranger":    (3,  9),
    "Caster":    (5,  12),
    "Warrior":   (6,  14),
    "Enchanter": (7,  15),
    "Guardian":  (10, 20),
}

# Base outcome probabilities at 100% final hit chance
# These are shifted by HitChanceEvaluator.shift_probabilities before rolling
DICE_BASE_PROBABILITIES = {
    "Boosted":  0.15,
    "Success":  0.45,
    "Tumbling": 0.10,
    "GuardUp":  0.20,
    "Evasion":  0.10,
}

# Outcome multipliers
BOOSTED_MULTIPLIER  = 1.5   # output × 1.5 on Boosted
TUMBLING_MULTIPLIER = 0.5   # output × 0.5 on Tumbling

# Guard Up: converts this fraction of raw output into target mitigation
GUARD_UP_MITIGATION = 0.10

# Tumbling outcome delays the attacker by 1–5 ticks on the timeline
TUMBLING_DELAY_MIN = 1
TUMBLING_DELAY_MAX = 5

# Evasion counter chain — diminishing probability per recursion depth
EVASION_COUNTER_BASE = 0.15  # 15% at depth 0
EVASION_COUNTER_STEP = 0.05  # drops 5% per additional depth
EVASION_COUNTER_MIN  = 0.01  # floor: never below 1%

# Unit limits
MAX_SKILL_SLOTS = 4
TEAM_SIZE_MAX   = 2   # maximum player characters per battle

# Input timing thresholds (used in input_service and input_helpers)
HOVER_THROTTLE_MS      = 100
LONG_PRESS_DURATION_MS = 500
SWIPE_MIN_DISTANCE_DP  = 50
DOUBLE_TAP_WINDOW_MS   = 300
