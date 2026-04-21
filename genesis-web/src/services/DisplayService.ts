import { Capacitor } from '@capacitor/core'

export async function initFullScreen(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.hide()
    // TODO (after npx cap add android):
    // Add MainActivity.kt onWindowFocusChanged with WindowInsetsControllerCompat
    // to hide the navigation bar and re-apply immersive mode after swipe-to-reveal.
    // See docs/ui/11_fullscreen_plan.md — Deferred native steps.
  } else {
    // Skip if already in a fullscreen or standalone context (PWA installed to home screen).
    const isAlreadyFullscreen =
      !!document.fullscreenElement ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches

    if (!isAlreadyFullscreen) {
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
}
