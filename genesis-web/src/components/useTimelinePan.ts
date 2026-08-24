// useTimelinePan — the tick stream's scroll behaviour.
//
// The strip auto-follows the now-line and can be dragged to look ahead, then
// recenters itself after a pause. Kept apart from TimelineStrip so the strip
// stays a render.

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { TIMELINE_OVERLAY_PX, TIMELINE_RECENTER_DELAY_MS } from '../core/constants'

interface Options {
  /** Y offset of the now-line within the track, in px. */
  nowTop:  number
  /** Changes whenever the stream advances, retriggering the follow. */
  tickKey: number
}

export function useTimelinePan({ nowTop, tickKey }: Options) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [offset, setOffset]     = useState(0)
  const [animated, setAnimated] = useState(false)
  const mountedRef = useRef(false)

  // clientHeight is 0 on mount, so the height has to be observed.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setContainerHeight(entries[0].contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const anchorOffset = () => containerHeight - TIMELINE_OVERLAY_PX - 10 - nowTop

  // Snap on first measurement; animate every later advance.
  useEffect(() => {
    if (containerHeight === 0) return
    setOffset(anchorOffset())
    if (!mountedRef.current) { mountedRef.current = true; setAnimated(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickKey, nowTop, containerHeight])

  const dragStartY     = useRef(0)
  const dragBaseOffset = useRef(0)
  const recenterTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (recenterTimer.current) clearTimeout(recenterTimer.current) }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (recenterTimer.current) clearTimeout(recenterTimer.current)
    dragStartY.current     = e.clientY
    dragBaseOffset.current = offset
    setAnimated(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    setOffset(dragBaseOffset.current + (e.clientY - dragStartY.current))
  }

  const onPointerUp = () => {
    setAnimated(true)
    if (recenterTimer.current) clearTimeout(recenterTimer.current)
    recenterTimer.current = setTimeout(() => setOffset(anchorOffset()), TIMELINE_RECENTER_DELAY_MS)
  }

  return {
    containerRef,
    offset,
    animated,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}
