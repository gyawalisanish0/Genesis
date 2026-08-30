// ErrorBoundary — the last line of defence.
// Anatomy and the two mount points: docs/ui/01-components.md § ErrorBoundary.
//
// Without one of these, an uncaught render throw does not show an error — it
// empties the DOM. React unmounts the whole tree, and because routing is
// hash-based the player is left on a black screen with no way back but a manual
// reload. That was the app's behaviour until this component existed.
//
// It deliberately depends on nothing but Panel and PixelButton: no router, no
// screen context, no store. A boundary that needs the thing that just broke is
// not a boundary.

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Panel } from './Panel'
import { PixelButton } from './PixelButton'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
  /** Named in the panel and the console line, so a report says where it broke. */
  area: string
  /** Offered beside RELOAD. Omit where there is nowhere safer to go. */
  onRecover?: () => void
  recoverLabel?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The stack is the only diagnostic there is — the game ships no telemetry.
    console.error(`[${this.props.area}]`, error, info.componentStack)
  }

  private recover = (): void => {
    this.setState({ error: null })
    this.props.onRecover?.()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    const { area, onRecover, recoverLabel = 'BACK TO MENU' } = this.props
    return (
      <div className={styles.root}>
        <Panel variant="danger" className={styles.panel}>
          <h1 className={styles.title}>SYSTEM FAULT</h1>
          <p className={styles.area}>{area}</p>
          {/* The message, not the stack. The stack is in the console for
              whoever is debugging; on a phone it is unreadable noise. */}
          <p className={styles.message}>{error.message || 'Unknown error'}</p>
          <div className={styles.actions}>
            {onRecover && (
              <PixelButton variant="secondary" onPress={this.recover}>
                {recoverLabel}
              </PixelButton>
            )}
            <PixelButton variant="danger" onPress={() => window.location.reload()}>
              RELOAD
            </PixelButton>
          </div>
        </Panel>
      </div>
    )
  }
}
