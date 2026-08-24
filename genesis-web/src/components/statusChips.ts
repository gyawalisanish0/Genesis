// Status chip construction, shared by everything that renders a StatusChipBar.
//
// The arena and the timeline hold different shapes — the arena gets
// TurnDisplayUnitData from the engine, the timeline holds live Units — so the
// two entry points differ, but the chip they produce is built in exactly one
// place.

import type { Unit, StatusChipDef } from '../core/types'
import { characterStatusIconUrl } from '../services/DataService'
import type { StatusChipData } from './StatusChipBar'

export type ChipResolver = (statusId: string) => StatusChipDef | null

/** Slot shape common to Unit.statusSlots and TurnDisplayUnitData.statusSlots. */
interface SlotLike {
  id:       string
  stacks:   number
  duration: number
}

function toChip(slot: SlotLike, chip: StatusChipDef, defId: string): StatusChipData {
  return {
    slotId:          slot.id,
    label:           chip.label,
    colour:          chip.colour,
    durationDisplay: chip.durationDisplay,
    // Indefinite statuses have no duration, so show stacks instead.
    duration:        slot.duration > 0 ? slot.duration : slot.stacks,
    iconUrl:         chip.icon ? characterStatusIconUrl(defId, chip.icon) : undefined,
    description:     chip.description,
    portraitGlow:    chip.portraitGlow,
  }
}

/** Chips for a live Unit, minus any the screen is currently suppressing. */
export function chipsForUnit(
  unit:       Unit,
  resolve:    ChipResolver,
  suppressed: ReadonlySet<string> = new Set(),
): StatusChipData[] {
  return unit.statusSlots.flatMap((slot) => {
    if (suppressed.has(slot.id)) return []
    const chip = resolve(slot.id)
    return chip ? [toChip(slot, chip, unit.defId)] : []
  })
}

/** Chips from engine display data, which carries slots but not the unit. */
export function chipsForSlots(
  slots:   ReadonlyArray<SlotLike>,
  defId:   string,
  resolve: ChipResolver,
): StatusChipData[] {
  return slots.flatMap((slot) => {
    const chip = resolve(slot.id)
    return chip ? [toChip(slot, chip, defId)] : []
  })
}
