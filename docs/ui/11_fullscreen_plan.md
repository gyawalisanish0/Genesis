# Full-Screen & Viewport Scaling — Implementation

## Goal

Every Genesis screen runs **edge-to-edge immersive** at 1080 × 1920 px (Full
HD portrait). System bars (status bar, navigation bar) are hidden. Safe-area
insets are read dynamically via CSS `env()` so interactive content never
overlaps cameras, notches, or gesture handles.

---

## Three Fullscreen Delivery Paths

| Context | Mechanism | Status |
|---|---|---|
| Capacitor native (Android/iOS) | `DisplayService.initFullScreen()` → `StatusBar.hide()` + `setOverlaysWebView(true)` | ✅ JS layer done; deferred native hardening below |
| PWA installed (home screen) | `public/manifest.json` `display: standalone` — no browser chrome | ✅ Done |
| Plain browser tab | `DisplayService` `pointerdown` listener + `SplashScreen` tap gate | ✅ Done |

---

## Architecture Overview

The implementation uses a **game-engine style CSS transform scale**:

1. `.viewport` uses `position: fixed; inset: 0` — pins to viewport corners with no arithmetic (avoids `100vw/100vh` vs `window.innerWidth/Height` mismatch on some browsers).
2. The inner viewport is fixed at **360 px wide** (CSS dp base).
3. `useViewportScale` computes a uniform scale factor; listens to `resize`, `orientationchange`, and `visualViewport.resize`.
4. `App.tsx` applies the scale as `transform: scale(N)` on the inner container.
5. `DisplayService.initFullScreen()` hides system bars on launch.
6. `tokens.css` safe-area vars divide by `--app-scale` to stay physically correct.

```
┌─ browser / device window ─────────────────────────────────────────┐
│  .viewport (position:fixed; inset:0 — pins to viewport corners)    │
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
| `src/utils/useViewportScale.ts` | Computes `scale` + `innerHeight`; updates on `resize`, `orientationchange`, `visualViewport.resize` |
| `src/services/DisplayService.ts` | Hides system bars on launch (Capacitor native + web Fullscreen API) |
| `src/screens/SplashScreen.tsx` | `isBrowserTab()` detection; tap gate in browser mode |
| `src/App.tsx` | Applies scale transform inline; calls `initFullScreen`; sets `--app-scale` CSS var |
| `src/App.module.css` | Outer black wrapper — `position: fixed; inset: 0` pins to viewport corners; inner container with `transform-origin` + `will-change` |
| `src/styles/tokens.css` | `--app-scale: 1` fallback; safe-area vars use `calc(env(...) / var(--app-scale))` |
| `public/manifest.json` | PWA manifest — `display: standalone`, portrait, `#0a0a14` theme |
| `capacitor.config.ts` | `StatusBar.overlaysWebView: true` — WebView bleeds under status bar before JS |

---

## PWA Manifest (`public/manifest.json`)

```json
{
  "name": "Genesis",
  "short_name": "Genesis",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a14",
  "theme_color": "#0a0a14",
  "start_url": "./"
}
```

`display: "standalone"` — when installed to home screen via Android Chrome or
iOS Safari "Add to Home Screen", the app opens with no browser address bar or
navigation chrome. No Fullscreen API needed. `SplashScreen` detects this via
`window.matchMedia('(display-mode: standalone)')` and skips the tap gate.

> **Note**: replace the placeholder icon with proper 192×192 and 512×512
> square PNGs when app icon assets are ready.

---

## Splash Gate (browser tab mode)

`SplashScreen.isBrowserTab()` returns `true` only when running as a plain
browser tab — not Capacitor, not PWA standalone, not already fullscreen:

```ts
function isBrowserTab(): boolean {
  if (Capacitor.isNativePlatform()) return false
  if (window.matchMedia('(display-mode: standalone)').matches) return false
  if (window.matchMedia('(display-mode: fullscreen)').matches) return false
  return true
}
```

When `isBrowserTab()` is true, after loading completes the splash screen:
1. Stays on screen — does NOT auto-navigate
2. Shows a pulsing "TAP ANYWHERE TO ENTER" prompt
3. On tap: `DisplayService` capture listener fires `requestFullscreen()` first, then
   `SplashScreen`'s `onPointerDown` navigates to Main Menu

Both happen on the same gesture; fullscreen is live before Main Menu renders.

`DisplayService` also skips registering the listener if already in a fullscreen
context (PWA / fullscreen API already active) to avoid double-registration.

---

## `useViewportScale`

```ts
// Portrait (w ≤ h): fill the full screen width — phones and tall tablets.
// Landscape (w > h): letterbox to a 9:16 column — prevents an unusably short
// canvas on desktop or rotated tablet.
const scale = w <= h
  ? w / BASE_WIDTH
  : Math.min(w / BASE_WIDTH, h / FALLBACK_HEIGHT)
const innerHeight = Math.round(h / scale)
```

- `BASE_WIDTH = 360` — the CSS design base; defines what 1 rem equals
- `FALLBACK_HEIGHT = 640` — landscape reference height (9:16); also serves as JSDOM guard (`window.innerHeight || 640`)
- Every portrait device fills edge-to-edge with no letterbox; taller phones get more vertical canvas
- Desktop/landscape: constrained to a centred portrait column with black bars
- Listens to `window resize`, `orientationchange`, and `visualViewport resize` (fires when the mobile URL bar shows/hides — `window resize` does not fire in that case)

| Device | orientation | scale | canvas dp |
|---|---|---|---|
| 360×640 (9:16) | portrait | 1.0 | 360×640 |
| 390×844 (iPhone 14) | portrait | 1.08 | 360×779 |
| 360×800 (20:9) | portrait | 1.0 | 360×800 |
| 412×915 (Pixel 6) | portrait | 1.14 | 360×803 |
| 768×1024 (tablet portrait) | portrait | 2.13 | 360×480 |
| 1920×1080 (desktop) | landscape | 1.69 | 360×640 |
| 1280×800 (laptop) | landscape | 1.25 | 360×640 |

---

## `DisplayService.initFullScreen`

```ts
export async function initFullScreen(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.hide()
    // TODO (after npx cap add android): MainActivity.kt onWindowFocusChanged
    // for navigation bar immersive mode — see Deferred Native Steps below.
  } else {
    const isAlreadyFullscreen =
      !!document.fullscreenElement ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches

    if (!isAlreadyFullscreen) {
      document.addEventListener('pointerdown', () => {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        }
      }, { once: true, capture: true })
    }
  }
}
```

---

## Safe-Area Correction

Without correction, `env(safe-area-inset-top)` returns a physical-screen value.
Inside `transform: scale(N)` it appears `N×` too large. Fix in `tokens.css`:

```css
:root {
  --app-scale: 1;  /* updated at runtime by App.tsx */

  --safe-top:    calc(env(safe-area-inset-top,    0rem) / var(--app-scale));
  --safe-bottom: calc(env(safe-area-inset-bottom, 0rem) / var(--app-scale));
  --safe-left:   calc(env(safe-area-inset-left,   0rem) / var(--app-scale));
  --safe-right:  calc(env(safe-area-inset-right,  0rem) / var(--app-scale));
}
```

All screens use `var(--safe-top)` etc. via `ScreenShell` — no screen changes needed.

The `env()` fallback is `0rem` on all four sides. Non-zero fallbacks would create phantom padding on browsers/devices that don't support `env()` or have no physical inset (desktop). On real devices `env()` always returns the correct physical value.

`ScreenContext.readCssSafeInsets()` mirrors this: it reads computed style from a temporary element and returns the raw number without any non-zero fallback — `parseFloat(value) || 0` — so JS-side inset values are also zero on desktop.

---

## Reference Insets (runtime values on real devices)

| Inset | Typical value | Note |
|---|---|---|
| Top | 24–59 dp | Camera cutout / status bar (device-reported via env()) |
| Bottom | 20–34 dp | Gesture bar / home indicator (device-reported via env()) |
| Left | 0 dp | Portrait — no side insets |
| Right | 0 dp | Portrait — no side insets |

---

## Deferred Native Steps

These require native project directories to exist first (`npx cap add android` / `npx cap add ios`).

### Android — hide navigation bar (full immersive mode)

**File**: `android/app/src/main/java/…/MainActivity.kt`

```kotlin
override fun onWindowFocusChanged(hasFocus: Boolean) {
  super.onWindowFocusChanged(hasFocus)
  if (hasFocus) {
    WindowInsetsControllerCompat(window, window.decorView).let { ctrl ->
      ctrl.hide(WindowInsetsCompat.Type.systemBars())
      ctrl.systemBarsBehavior =
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
  }
}
```

`onWindowFocusChanged` re-applies immersive mode every time the system briefly
re-shows bars (e.g. notification shade swipe).

### Android — fix cold-launch status bar flash

**File**: `android/app/src/main/res/values/styles.xml` — add to launch theme:

```xml
<item name="android:windowTranslucentStatus">true</item>
<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
```

These flags apply before the WebView paints, eliminating the brief status bar
visible at cold launch.

### iOS — hardening

**File**: `ios/App/App/Info.plist` — verify/add:

```xml
<key>UIStatusBarHidden</key><true/>
<key>UIRequiresFullScreen</key><true/>
<key>UIViewControllerBasedStatusBarAppearance</key><false/>
```

`UIRequiresFullScreen` prevents slide-over on iPad.
`UIViewControllerBasedStatusBarAppearance = NO` lets the Capacitor StatusBar
plugin override the status bar style app-wide.

---

## Capacitor Plugin

`@capacitor/status-bar: ^8.0.2` is installed. It is imported dynamically inside
`DisplayService` so the web bundle is not affected when the plugin is absent.

---

## Scope Boundary

Not in scope:
- Orientation lock (handled by `capacitor.config.ts` `orientation` field / Android manifest)
- Asset density selection at runtime (future)
- Dynamic reflow for foldables or split-screen (future)
