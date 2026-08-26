// Demo flow wiring — Arc: Unknown Relay.
//
// The one place the demo's specific content is named. Kept separate from
// constants so it is obvious what is demo scaffolding and what is engine: when
// the campaign becomes real, this file is deleted rather than untangled.
//
// Spec: docs/demo/demo-flow.md, docs/design/fleet-layer-concept.md § 4.

/** Reaching this stage's exit ends the deployment and triggers the fleet update. */
export const DEMO_FINAL_STAGE_ID = 'stage_003'

/**
 * Units that join the Commander's fleet when the demo's final stage is cleared.
 *
 * Tara is deliberately absent. She is deployed for all three stages and is not
 * recruited — playing beside someone and then not keeping them generates the
 * want that the demo's ending is for. Her departure is handled in the authored
 * ending scene, not here; this file only records who joins.
 */
export const DEMO_RECRUIT_DEF_IDS = ['hugo_001', 'husty_001'] as const

/** Hold on the exit tile before the screen changes, so the step registers. */
export const DUNGEON_EXIT_HOLD_MS = 1200
