import { Capacitor } from '@capacitor/core'

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
