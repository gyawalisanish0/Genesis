// Standby — the last thing the demo shows.
//
// DELIBERATELY UNFINISHED. The designer is authoring this screen and asked
// specifically that it not be built as a typical end-of-demo screen, so this
// file is the frame and the plumbing only:
//
//   · it is routable and reachable from the unlock screen
//   · it holds the run open rather than dumping the player to a menu
//   · it carries no "thanks for playing", no marketing card, no fake mission
//     board, no next-episode teaser
//
// The empty region below is the canvas. Whatever goes there is a design
// decision, not an implementation one — see docs/design/fleet-layer-concept.md
// § 7 and the note that this demo's scope is mostly absence, so how absence is
// presented is most of the felt quality.
//
// The one thing already decided: the run does not end by ejecting the player.
// There is deliberately no main menu here — the demo is the whole product, and
// offering a menu implies modes and content that do not exist. A player who
// reaches the end either runs it again or reads who made it.

import { ScreenShell }  from '../navigation/ScreenShell'
import { useScreen }    from '../navigation/useScreen'
import { SCREEN_IDS }   from '../navigation/screenRegistry'
import { useGameStore } from '../core/GameContext'
import { PixelButton }  from '../components/PixelButton'
import styles from './ComingSoonScreen.module.css'

export function ComingSoonScreen() {
  const { navigateTo } = useScreen()
  const orgName = useGameStore((s) => s.organisationName)
  const fleet    = useGameStore((s) => s.fleet)
  const resetRun = useGameStore((s) => s.resetRun)

  return (
    <ScreenShell>
      <div className={styles.root}>
        <header className={styles.header}>
          {orgName && <p className={styles.org}>{orgName}</p>}
          <h1 className={styles.title}>STANDBY</h1>
        </header>

        {/* ── DESIGNER CANVAS ──────────────────────────────────────────────
            Intentionally empty. Whatever states that more exists beyond Mars
            belongs here, in whatever form is decided — it is not assumed to be
            a list, a board, or a teaser. The surrounding frame, the fleet
            count and the exit are wired and can be relied on.
            ───────────────────────────────────────────────────────────────── */}
        <div className={styles.canvas} />

        <footer className={styles.footer}>
          <p className={styles.fleetLine}>
            FLEET · {fleet.recruitedIds.length} ASSIGNED
          </p>
          <PixelButton
            variant="ghost"
            onPress={() => { resetRun(); navigateTo(SCREEN_IDS.SPLASH) }}
          >
            RUN IT AGAIN
          </PixelButton>
          <p className={styles.credit}>GENESIS · A PROOF OF CONCEPT</p>
        </footer>
      </div>
    </ScreenShell>
  )
}
