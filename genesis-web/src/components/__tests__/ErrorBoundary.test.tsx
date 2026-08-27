// @vitest-environment jsdom
//
// The property under test is blunt: without a boundary, an uncaught render
// throw does not show an error, it empties the DOM. React unmounts the tree and
// the player is left on a black screen with no route back. The first test here
// is the negative control that proves that is what happens, so the rest are
// measuring something real.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function Boom({ message = 'no handler for effect type "tickShove"' }): React.ReactElement {
  throw new Error(message)
}

/** React logs caught errors to console.error; silence it, don't hide failures. */
function quietConsole() {
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('the hazard the boundary exists for', () => {
  it('an unguarded render throw empties the container', () => {
    quietConsole()
    const host = document.createElement('div')
    document.body.appendChild(host)

    expect(() => render(<Boom />, { container: host })).toThrow()
    expect(host.innerHTML).toBe('')
  })
})

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary area="TEST"><p>battle</p></ErrorBoundary>)
    expect(screen.getByText('battle')).toBeTruthy()
  })

  it('contains the throw and keeps a surface on screen', () => {
    quietConsole()
    render(<ErrorBoundary area="/battle"><Boom /></ErrorBoundary>)

    expect(screen.getByText('SYSTEM FAULT')).toBeTruthy()
    expect(screen.getByText('RELOAD')).toBeTruthy()
  })

  it('names where it broke, so a bug report is actionable', () => {
    quietConsole()
    render(<ErrorBoundary area="/dungeon"><Boom /></ErrorBoundary>)

    expect(screen.getByText('/dungeon')).toBeTruthy()
    expect(screen.getByText('no handler for effect type "tickShove"')).toBeTruthy()
  })

  it('logs the error and the component stack for whoever is debugging', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary area="/battle"><Boom /></ErrorBoundary>)

    expect(spy.mock.calls.some(([tag]) => tag === '[/battle]')).toBe(true)
  })

  it('offers no recovery action when there is nowhere safer to go', () => {
    // The root boundary omits onRecover: at that level the router may be what
    // failed, so reload is the only honest option.
    quietConsole()
    render(<ErrorBoundary area="APP"><Boom /></ErrorBoundary>)

    expect(screen.queryByText('BACK TO MENU')).toBeNull()
    expect(screen.getByText('RELOAD')).toBeTruthy()
  })

  it('recovers on demand and re-renders the subtree', () => {
    quietConsole()
    const onRecover = vi.fn()

    function Flaky({ explode }: { explode: boolean }) {
      if (explode) throw new Error('boom')
      return <p>recovered</p>
    }

    const { rerender } = render(
      <ErrorBoundary area="/battle" onRecover={onRecover}>
        <Flaky explode />
      </ErrorBoundary>,
    )
    expect(screen.getByText('SYSTEM FAULT')).toBeTruthy()

    // The real recovery navigates away, which unmounts the thrower. Model that
    // by swapping in a child that no longer throws before clearing the error.
    rerender(
      <ErrorBoundary area="/battle" onRecover={onRecover}>
        <Flaky explode={false} />
      </ErrorBoundary>,
    )
    fireEvent.pointerDown(screen.getByText('BACK TO MENU'))

    expect(onRecover).toHaveBeenCalled()
    expect(screen.getByText('recovered')).toBeTruthy()
  })

  it('falls back to a readable label when the error carries no message', () => {
    quietConsole()
    render(<ErrorBoundary area="APP"><Boom message="" /></ErrorBoundary>)
    expect(screen.getByText('Unknown error')).toBeTruthy()
  })
})
