// Presentation constants — arena geometry, animation timing, bar segmentation,
// toasts and default settings. Split out of constants.ts, which kept exceeding
// the 150-line module limit. Re-exported from './constants'.

import type { AppSettings } from './types'

// Battle arena — GBA duel frame geometry (dp; all multiples of 2 dp = 1 art px)
export const SPRITE_BOX_DP        = 96    // 48 art px at 2x — the GBA 26.7%-of-width ratio
export const PLATFORM_W_DP        = 96    // shadow disc under a combatant
export const PLATFORM_H_DP        = 16
export const SPRITE_BOB_PERIOD_MS = 1600  // idle breathing cycle
export const SPRITE_BOB_DIP_DP    = 2     // 1 art px
export const SHOVE_STEP_DP        = 8     // contact step toward the target
export const SHOVE_OUT_MS         = 190
export const SHAKE_AMPLITUDE_DP   = 4
export const SHAKE_HIT_MS         = 160
export const SHAKE_BOOSTED_MS     = 320
export const EVADE_DODGE_DX_DP    = 16    // sidestep distance on an evade
export const EVADE_DODGE_MS       = 170
export const FLASH_HOLD_MS        = 96    // impact silhouette flash
export const DEATH_FADE_MS        = 480
export const SEQUENCE_BUDGET_MS   = 1400  // must fit inside ANIM_TIMEOUT_MS

// Dice roll — the needle sweeps the odds band, then settles in the rolled zone.
// Sweep + settle must fit inside DICE_RESULT_DISMISS_MS (1200) or the roll is
// cut off before the player reads it.
export const DICE_SWEEP_MS  = 720   // needle travel before it locks on
export const DICE_SETTLE_MS = 380   // hold on the result after landing

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
