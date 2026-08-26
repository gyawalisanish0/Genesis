// Suppress the browser gestures that give away that a game is a web page.
//
// CSS handles selection and the iOS callout (styles/base.css). These are the
// ones CSS cannot reach — they are events, and the browser's defaults for them
// are all wrong here:
//
//   contextmenu  long-press or right-click opens a menu over the battlefield
//   selectstart  a drag across the HUD paints a blue selection
//   dragstart    a portrait or sprite can be dragged out of the page
//   copy/cut     a game has no clipboard affordance to offer
//
// Registered once from App.tsx, on window, in the capture phase so a stray
// handler further down cannot re-enable them.

/** Form fields keep normal behaviour — the opening script asks the player to type. */
function isTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable === true
}

/** Events blocked everywhere, with no exemption. */
const ALWAYS_BLOCKED = ['contextmenu', 'dragstart', 'selectstart'] as const

/**
 * Events blocked outside form fields.
 *
 * Copy and cut are suppressed because there is nothing in a battle worth
 * lifting to a clipboard, and the selection they imply is already disabled.
 * Paste stays available inside the name field: the player types their own name
 * and their organisation's there, and refusing a paste in the one place the
 * game asks for typed input is hostile rather than immersive.
 */
const BLOCKED_OUTSIDE_FIELDS = ['copy', 'cut'] as const

let installed = false

/** Idempotent — safe to call from an effect that may run twice in StrictMode. */
export function suppressWebGestures(): () => void {
  if (installed) return () => {}
  installed = true

  const block = (e: Event) => e.preventDefault()
  const blockOutsideFields = (e: Event) => {
    if (!isTextField(e.target)) e.preventDefault()
  }

  for (const type of ALWAYS_BLOCKED) {
    window.addEventListener(type, block, { capture: true })
  }
  for (const type of BLOCKED_OUTSIDE_FIELDS) {
    window.addEventListener(type, blockOutsideFields, { capture: true })
  }

  return () => {
    for (const type of ALWAYS_BLOCKED) {
      window.removeEventListener(type, block, { capture: true })
    }
    for (const type of BLOCKED_OUTSIDE_FIELDS) {
      window.removeEventListener(type, blockOutsideFields, { capture: true })
    }
    installed = false
  }
}
