# Full-Screen & Viewport Scaling — Implementation

## Goal

Every Genesis screen runs **edge-to-edge immersive** at 1080 × 1920 px (Full
HD portrait). System bars (status bar, navigation bar) are hidden. Safe-area
insets are read dynamically via CSS `env()` so interactive content never
overlaps cameras, notches, or gesture handles.

---

## Architecture Overview

The implementation uses a **game-engine style CSS transform scale**:

1. The inner viewport is fixed at **360 px wide** (CSS dp base).
2. `useViewportScale` computes a uniform scale factor each frame.
3. `App.tsx` applies the scale as `transform: scale(N)` on the inner container.
4. `DisplayService.initFullScreen()` hides system bars on launch.
5. `tokens.css` safe-area vars divide by `--app-scale` to stay physically correct.

```
┌─ browser / device window ─────────────────────────────────────────┐
│  .viewport (100vw × 100vh, black background)                       │
│  ┌─ .viewportInner ────────────────────────────────────────────┐   │
│  │  width: 360px  height: innerHeight px                        │   │
│  │  transform: scale(N)  transform-origin: center              │   │
│  │  will-change: transform                                     │   │
│  │                                                             │   │
│  │  <HashRouter> → screens fill 100% of this inner box        │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

On **mobile portrait** (360 dp wide or similar): `scale ≈ 1`; inner box fills
the screen edge-to-edge with no letterbox.

On **desktop / landscape**: `scale < 1`; black bars fill the space outside
the inner box.

---

## Files

| File | Purpose |
|---|---|
| `src/utils/useViewportScale.ts` | Computes `scale` + `innerHeight`; updates on resize / orientationchange |
| `src/services/DisplayService.ts` | Hides system bars on launch (Capacitor native + web Fullscreen API) |
| `src/App.tsx` | Applies scale transform inline; calls `initFullScreen`; sets `--app-scale` CSS var |
| `src/App.module.css` | Outer black wrapper + inner container with `transform-origin` + `will-change` |
| `src/styles/tokens.css` | `--app-scale: 1` fallback; safe-area vars use `calc(env(...) / var(--app-scale))` |

---

## `useViewportScale`

```ts
// src/utils/useViewportScale.ts
const BASE_WIDTH  = 360
const BASE_HEIGHT = 640

function compute(): ViewportScale {
  const w = window.innerWidth  || BASE_WIDTH
  const h = window.innerHeight || BASE_HEIGHT
  const scale = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT)
  return { scale, innerHeight: Math.round(h / scale) }
}
```

- `scale = Math.min(w/360, h/640)` — uniform scale; fills the smaller axis exactly
- `innerHeight = screenH / scale` — inner container height that fills the device vertically after scaling
- Listens to `resize` and `orientationchange`; JSDOM-safe (`|| BASE_WIDTH` guard prevents division by zero in tests)

---

## `DisplayService.initFullScreen`

```ts
// src/services/DisplayService.ts
export async function initFullScreen(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.hide()
  } else {
    document.addEventListener(
      'pointerdown',
      () => {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        }
      },
      { once: true, capture: true },
    )
  }
}
```

**Native path** — called once on `App` mount:
- `setOverlaysWebView({ overlay: true })` — WebView bleeds under the status bar
- `StatusBar.hide()` — status bar is hidden (immersive)

**Web path** — registers a `{ once: true }` `pointerdown` listener:
- Calls `requestFullscreen()` on the first user tap (required by browser security)
- Fails silently if browser denies (e.g. iframes, some mobile browsers)

---

## `App.tsx` integration

```tsx
export default function App() {
  const { scale, innerHeight } = useViewportScale()

  useEffect(() => { initFullScreen().catch(() => {}) }, [])

  // Let tokens.css safe-area vars self-correct via calc(env(...) / var(--app-scale))
  useEffect(() => {
    document.documentElement.style.setProperty('--app-scale', String(scale))
  }, [scale])

  return (
    <div className={styles.viewport}>
      <div
        className={styles.viewportInner}
        style={{ width: '360px', height: `${innerHeight}px`, transform: `scale(${scale})` }}
      >
        <HashRouter>…</HashRouter>
      </div>
    </div>
  )
}
```

---

## Safe-Area Correction

Without correction, `env(safe-area-inset-top)` returns a value in physical
screen pixels. Inside a `transform: scale(N)` container those pixels appear
`N×` larger than intended. The fix in `tokens.css`:

```css
:root {
  --app-scale: 1;  /* updated at runtime by App.tsx */

  --safe-top:    calc(env(safe-area-inset-top,    1.5rem) / var(--app-scale));
  --safe-bottom: calc(env(safe-area-inset-bottom, 3rem)   / var(--app-scale));
  --safe-left:   calc(env(safe-area-inset-left,   0rem)   / var(--app-scale));
  --safe-right:  calc(env(safe-area-inset-right,  0rem)   / var(--app-scale));
}
```

All screens use `var(--safe-top)` etc. via `ScreenShell` — no screen-level changes needed.

---

## Reference Insets (fallback values)

| Inset | Default | Note |
|---|---|---|
| Top | 1.5 rem (24 dp) | Camera / status bar region |
| Bottom | 3 rem (48 dp) | Gesture bar / home indicator |
| Left | 0 rem | Portrait — no side insets |
| Right | 0 rem | Portrait — no side insets |

---

## Capacitor Plugin

`@capacitor/status-bar: ^8.0.2` is installed. It is imported dynamically inside
`DisplayService` so the web bundle is not affected when the plugin is absent.

---

## Scope Boundary

This implementation covers **viewport scaling and system bar hiding only**.

Not in scope:
- Orientation lock (handled by `capacitor.config.ts` / Android manifest)
- Asset density selection at runtime (future)
- Dynamic reflow for foldables or split-screen (future)
