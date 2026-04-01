"""
display_service package.

Public API
----------
init()          — Create the singleton, apply immersive mode, read insets.
                  Call once as the first operation in App.build().
get()           — Retrieve the live singleton from anywhere.
DisplayService  — The class itself (rarely needed directly).

Example
-------
    # main.py
    from app.services.display_service import init
    init()

    # any screen
    from app.services.display_service import get
    insets = get().get_safe_insets()
    self.ids.root_layout.padding = [
        insets["left"], insets["bottom"],
        insets["right"], insets["top"],
    ]
"""

from app.services.display_service.display_service import DisplayService

_instance: DisplayService | None = None


def init() -> DisplayService:
    """
    Instantiate DisplayService, apply full-screen mode, and cache insets.
    Must be the first service initialised inside App.build().
    """
    global _instance
    _instance = DisplayService()
    return _instance


def get() -> DisplayService | None:
    """Return the live singleton (None before init() is called)."""
    return _instance


__all__ = ["DisplayService", "init", "get"]
