// Campaign progression — which stages the Commander may deploy to.
//
// Pure functions over the ordered stage list and the fleet's completed set, so
// the rule is testable without a screen. CampaignScreen previously hardcoded
// `unlocked={idx === 0}`, which made every stage after the first unreachable
// and the demo's ending along with them.

/**
 * A stage is available if it is the first, or the stage before it is cleared.
 *
 * Strictly sequential on purpose: the demo escalates deliberately (bigger maps,
 * more patrols, a new enemy type per stage), so skipping ahead would skip the
 * teaching. `order` is the campaign index order, which is the authored order.
 */
export function isStageUnlocked(
  order: readonly string[],
  stageId: string,
  completed: readonly string[],
): boolean {
  const idx = order.indexOf(stageId)
  if (idx < 0) return false
  if (idx === 0) return true
  return completed.includes(order[idx - 1])
}

/**
 * The stage the player should drop into by default — the first unfinished one,
 * or the last stage once everything is cleared so the campaign is re-playable
 * rather than a dead end.
 */
export function nextStageId(
  order: readonly string[],
  completed: readonly string[],
): string | null {
  if (order.length === 0) return null
  return order.find((id) => !completed.includes(id)) ?? order[order.length - 1]
}

/** Whether every authored stage has been cleared. */
export function isCampaignComplete(
  order: readonly string[],
  completed: readonly string[],
): boolean {
  return order.length > 0 && order.every((id) => completed.includes(id))
}
