"""
DisplayService1 — Android immersive mode.

Handles full-screen sticky immersive setup for both modern (API ≥ 30,
WindowInsetsController) and legacy (API < 30, SystemUiVisibility flags)
Android APIs.  No-op on iOS and desktop — full-screen is handled by
buildozer/Kivy Config on those platforms.
"""

from kivy.utils import platform


class DisplayService1:
    """Sets and re-applies Android immersive sticky mode."""

    def apply_immersive(self) -> None:
        """
        Hide system bars and enter immersive sticky mode.
        Safe to call on any platform — only acts on Android.
        Never raises: exceptions are logged and swallowed so a display
        failure never crashes the app.
        """
        if platform == "android":
            try:
                self._apply_android()
            except Exception as exc:
                from kivy.logger import Logger
                Logger.warning("DisplayService1: immersive setup failed: %s", exc)

    # ── Android dispatch ──────────────────────────────────────────────────────

    def _apply_android(self) -> None:
        from jnius import autoclass  # noqa: PLC0415 — runtime Android-only
        Build    = autoclass("android.os.Build")
        activity = autoclass("org.kivy.android.PythonActivity").mActivity
        if activity is None:
            from kivy.logger import Logger
            Logger.warning("DisplayService1: mActivity is None — skipping immersive")
            return
        if Build.VERSION.SDK_INT >= 30:
            self._apply_modern(activity)
        else:
            self._apply_legacy(activity)

    def _apply_modern(self, activity) -> None:
        """
        API ≥ 30: WindowInsetsController — the preferred path.
        Hides status + navigation bars; bars re-appear transiently on swipe.
        """
        from jnius import autoclass
        window     = activity.getWindow()
        controller = window.getInsetsController()
        if controller is None:
            # Window not yet attached — will be called again on on_restore
            return
        InsetType = autoclass("android.view.WindowInsets$Type")
        InsetCtrl = autoclass("android.view.WindowInsetsController")
        controller.hide(InsetType.statusBars() | InsetType.navigationBars())
        controller.setSystemBarsBehavior(
            InsetCtrl.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        )

    def _apply_legacy(self, activity) -> None:
        """
        API < 30: SystemUiVisibility flags — legacy path.
        Covers Android 5.0 (API 21) → Android 10 (API 29).
        """
        from jnius import autoclass
        View      = autoclass("android.view.View")
        decorView = activity.getWindow().getDecorView()
        flags = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        )
        decorView.setSystemUiVisibility(flags)
