"""
DisplayService2 — safe-area inset reading.

Reads camera/notch/gesture-bar insets from the platform and returns them
as dp values.  Three paths:
  • Android API ≥ 30  — WindowInsets.getInsets(systemBars())
  • Android API < 30  — getWindowVisibleDisplayFrame rect diff
  • Desktop / unknown — static fallback matching design-system reference values
"""

from kivy.utils import platform

# Reference fallback insets (dp) — match docs/ui/00_design_system.md defaults
_FALLBACK: dict = {"top": 24, "bottom": 48, "left": 0, "right": 0}


class DisplayService2:
    """Reads device safe-area insets and converts them to dp."""

    def read_insets(self) -> dict:
        """
        Return safe-area insets as dp integers:
            {"top": int, "bottom": int, "left": int, "right": int}
        Falls back to design-system reference values when the platform
        cannot report insets (desktop, emulator, unattached window).
        """
        if platform == "android":
            return self._read_android()
        return dict(_FALLBACK)

    # ── Android dispatch ──────────────────────────────────────────────────────

    def _read_android(self) -> dict:
        try:
            from jnius import autoclass  # noqa: PLC0415 — runtime Android-only
            Build    = autoclass("android.os.Build")
            activity = autoclass("org.kivy.android.PythonActivity").mActivity
            if activity is None:
                return dict(_FALLBACK)
            if Build.VERSION.SDK_INT >= 30:
                return self._read_modern(activity)
            return self._read_legacy(activity)
        except Exception as exc:
            from kivy.logger import Logger
            Logger.warning("DisplayService2: inset read failed, using fallback: %s", exc)
            return dict(_FALLBACK)

    def _read_modern(self, activity) -> dict:
        """API ≥ 30: WindowInsets.getInsets(systemBars())."""
        from jnius import autoclass
        InsetType   = autoclass("android.view.WindowInsets$Type")
        decorView   = activity.getWindow().getDecorView()
        root_insets = decorView.getRootWindowInsets()
        if root_insets is None:
            return dict(_FALLBACK)
        insets  = root_insets.getInsets(InsetType.systemBars())
        density = activity.getResources().getDisplayMetrics().density
        return {
            "top":    round(insets.top    / density),
            "bottom": round(insets.bottom / density),
            "left":   round(insets.left   / density),
            "right":  round(insets.right  / density),
        }

    def _read_legacy(self, activity) -> dict:
        """API < 30: getWindowVisibleDisplayFrame rect delta."""
        from jnius import autoclass
        Rect     = autoclass("android.graphics.Rect")
        metrics  = activity.getResources().getDisplayMetrics()
        density  = metrics.density
        screen_h = metrics.heightPixels
        rect     = Rect()
        activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(rect)
        return {
            "top":    round(rect.top / density),
            "bottom": round((screen_h - rect.bottom) / density),
            "left":   round(rect.left / density),
            "right":  0,
        }
