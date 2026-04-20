// Generic paged grid: configurable cols × rows, swipe, arrow buttons, dot indicators.

import { useState, useRef } from 'react'
import styles from './PagedGrid.module.css'

interface PagedGridProps<T> {
  items:       T[]
  cols:        number
  rows:        number
  renderItem:  (item: T, index: number) => React.ReactNode
  emptyText?:  string
  className?:  string
}

const SWIPE_THRESHOLD_PX = 40

export function PagedGrid<T>({ items, cols, rows, renderItem, emptyText = 'No items', className }: PagedGridProps<T>) {
  const [currentPage, setCurrentPage] = useState(0)
  const pointerStartX = useRef<number | null>(null)

  const pageSize   = cols * rows
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pageOffset = currentPage * pageSize
  const pageItems  = items.slice(pageOffset, pageOffset + pageSize)

  const prev = () => setCurrentPage((p) => Math.max(0, p - 1))
  const next = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    pointerStartX.current = e.clientX
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null) return
    const delta = e.clientX - pointerStartX.current
    pointerStartX.current = null
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    if (delta < 0) next()
    else prev()
  }

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {items.length === 0
          ? <p className={styles.empty} style={{ gridColumn: `1 / ${cols + 1}` }}>{emptyText}</p>
          : pageItems.map((item, i) => renderItem(item, pageOffset + i))
        }
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.arrowBtn} onClick={prev} disabled={currentPage === 0}>‹</button>
          <div className={styles.dots}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <span key={i} className={`${styles.dot} ${i === currentPage ? styles.dotActive : ''}`} />
            ))}
          </div>
          <span className={styles.pageCounter}>{currentPage + 1}/{totalPages}</span>
          <button className={styles.arrowBtn} onClick={next} disabled={currentPage === totalPages - 1}>›</button>
        </div>
      )}
    </div>
  )
}
