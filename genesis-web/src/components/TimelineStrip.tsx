// TimelineStrip — the tick stream.
//
// Genesis's own mechanic and, per CONCEPT.md, the thing everything else serves:
// an unbounded vertical stream where each unit holds its own position. The strip
// shows where everyone stands, how crowded each tick is, where the selected
// skill would land, and what the acting unit is about to spend.
// Spec: docs/ui/01-components.md § TimelineStrip.

import type { Unit } from '../core/types'
import type { HistoryEntry } from '../core/battleHistory'
import { TIMELINE_PX_PER_TICK } from '../core/constants'
import { countByTick, occupancyState, wouldDisplace } from '../core/combat/TickOccupancy'
import { TickToken } from './TickToken'
import { StatusChipBar } from './StatusChipBar'
import type { StatusChipData } from './StatusChipBar'
import { chipsForUnit } from './statusChips'
import type { ChipResolver } from './statusChips'
import { useTimelinePan } from './useTimelinePan'
import styles from './TimelineStrip.module.css'

/** tick → CSS top inside the track. Higher ticks sit nearer the top. */
export function tickToTop(tick: number, maxTick: number): number {
  return (maxTick - tick) * TIMELINE_PX_PER_TICK
}

/** Fan for units sharing a tick, centred on the tick line. Diagonal rather than
 *  purely vertical: at 8 dp of vertical offset a 24 dp token was two-thirds
 *  hidden, and a shared tick is exactly the case worth being able to read. */
const STACK_OFFSET_PX = 9
const STACK_OFFSET_X  = 7

interface Props {
  tickValue:      number
  units:          Unit[]
  activeUnitIds:  ReadonlySet<string>
  registeredTicks: ReadonlyMap<string, number>
  scrollBounds:   { min: number; max: number }
  historyEntries: HistoryEntry[]
  /** Tick the selected skill would land the acting unit on. */
  projectedTick:  number | null
  /** Unit doing the projecting — excluded from its own occupancy check. */
  projectingId:   string | null
  displacement:   { toTick: number; key: number } | null
  /** TU the acting unit is about to spend, when telegraphed. */
  intent:         { unitId: string; tuCost: number } | null
  resolveChip:    ChipResolver
  suppressedChipIds: ReadonlySet<string>
  onChipTap:      (chip: StatusChipData) => void
}

export function TimelineStrip({
  tickValue, units, activeUnitIds, registeredTicks, scrollBounds, historyEntries,
  projectedTick, projectingId, displacement, intent, resolveChip, suppressedChipIds, onChipTap,
}: Props) {
  const trackHeight = (scrollBounds.max - scrollBounds.min) * TIMELINE_PX_PER_TICK
  const top = (tick: number) => tickToTop(tick, scrollBounds.max)

  const { containerRef, offset, animated, handlers } = useTimelinePan({
    nowTop: top(tickValue), tickKey: tickValue,
  })

  const marks: number[] = []
  for (let t = scrollBounds.min; t <= scrollBounds.max; t += 10) marks.push(t)

  const occupancy = countByTick(registeredTicks)
  // A landing already at the cap will be shoved by a D8 roll on commit.
  const landingIsFull = projectedTick !== null && projectingId
    ? wouldDisplace(projectedTick, registeredTicks, projectingId)
    : false

  // Fan units that share a tick so none is hidden behind another.
  const groups = new Map<number, string[]>()
  for (const u of units) groups.set(u.tickPosition, [...(groups.get(u.tickPosition) ?? []), u.id])
  const fanIndex = (id: string, tick: number) => {
    const ids = groups.get(tick) ?? []
    return ids.indexOf(id) - (ids.length - 1) / 2
  }
  const stackedTop  = (id: string, tick: number) => top(tick) + fanIndex(id, tick) * STACK_OFFSET_PX
  const stackedLeft = (id: string, tick: number) => fanIndex(id, tick) * STACK_OFFSET_X

  return (
    <div className={styles.wrap} ref={containerRef}>
      <div
        className={`${styles.track} ${animated ? styles.trackAnimated : ''}`}
        style={{ height: trackHeight, transform: `translateY(${offset}px)` }}
        {...handlers}
      >
        <div className={styles.axis} />
        {marks.map(t => (
          <div key={t} className={`${styles.tickMark} ${t % 50 === 0 ? styles.tickMarkMajor : ''}`} style={{ top: top(t) }} />
        ))}

        {/* Occupancy — a tick at the cap displaces the next arrival. */}
        {[...occupancy].map(([tick, count]) => (
          <div key={`occ-${tick}`} className={`${styles.occupancy} ${styles[occupancyState(count)]}`}
               style={{ top: top(tick) }} aria-hidden />
        ))}

        <div className={styles.nowLine} style={{ top: top(tickValue) }} />

        {projectedTick !== null && (
          <div className={`${styles.projected} ${landingIsFull ? styles.projectedFull : ''}`}
               style={{ top: top(projectedTick) }} />
        )}

        {displacement && (
          <div key={displacement.key} className={styles.displaced} style={{ top: top(displacement.toTick) }} />
        )}

        {/* Ghosts first so live tokens paint over them. */}
        {historyEntries.map(entry => (
          <div key={entry.id} className={styles.marker} style={{ top: top(entry.tick) }}>
            <TickToken name={entry.name} rarity={1} isAlly={entry.isAlly} hpFraction={0} ghost />
          </div>
        ))}

        {units.map((unit) => {
          const chips = chipsForUnit(unit, resolveChip, suppressedChipIds)
          const active = activeUnitIds.has(unit.id)
          return (
            <div
              key={unit.id}
              className={`${styles.marker} ${active ? (unit.isAlly ? styles.activeAlly : styles.activeEnemy) : ''}`}
              style={{
                top:  stackedTop(unit.id, unit.tickPosition),
                marginLeft: stackedLeft(unit.id, unit.tickPosition),
              }}
            >
              <TickToken
                name={unit.name} rarity={unit.rarity} isAlly={unit.isAlly}
                hpFraction={unit.maxHp > 0 ? unit.hp / unit.maxHp : 0}
                tuIntent={intent?.unitId === unit.id ? intent.tuCost : null}
              />
              {chips.length > 0 && <StatusChipBar chips={chips} size="compact" onTap={onChipTap} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
