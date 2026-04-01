"""
DisplayService — full-screen setup and safe-area inset cache.

Single source of truth for all window / system-UI operations.
Composes DisplayService1 (immersive mode) and DisplayService2 (insets).

Usage
-----
    # main.py — first call inside App.build()
    from app.services.display_service import init
    init()

    # any screen or component
    from app.services.display_service import get
    insets = get().get_safe_insets()   # {"top":24, "bottom":48, ...}
"""

from app.services.display_service.display_service_1 import DisplayService1
from app.services.display_service.display_service_2 import DisplayService2


class DisplayService:
    """
    Initialises full-screen immersive mode and caches safe-area insets.
    Instantiated once by init(); accessed everywhere via get().
    """

    def __init__(self) -> None:
        self._immersive     = DisplayService1()
        self._inset_reader  = DisplayService2()
        self._safe_insets:  dict = {}

        # Set full-screen and read initial insets
        self._immersive.apply_immersive()
        self._safe_insets = self._inset_reader.read_insets()

        # Re-apply when the app returns from background.
        # Android re-shows system bars after the user swipes them in;
        # binding on_restore keeps the game consistently immersive.
        self._bind_window_restore()

    # ── Public API ────────────────────────────────────────────────────────────

    def get_safe_insets(self) -> dict:
        """
        Return cached safe-area insets in dp:
            {"top": int, "bottom": int, "left": int, "right": int}
        Insets are read at init and refreshed on app resume.
        Call refresh_insets() explicitly after layout changes if needed.
        """
        return dict(self._safe_insets)

    def refresh_insets(self) -> None:
        """Re-read insets from the platform and update the cache."""
        self._safe_insets = self._inset_reader.read_insets()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _bind_window_restore(self) -> None:
        # Lazy import — Window must exist (App.build() must be running)
        from kivy.core.window import Window
        Window.bind(on_restore=self._on_window_restore)

    def _on_window_restore(self, *_args) -> None:
        """Called when the app regains focus after backgrounding."""
        self._immersive.apply_immersive()
        self.refresh_insets()
