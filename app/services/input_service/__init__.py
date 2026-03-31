"""
input_service package.

Public API
----------
init()          — Create and store the singleton; call once in main.py.
get()           — Retrieve the live singleton from anywhere.
InputService    — The class itself (rarely needed directly).

Example
-------
    # main.py
    from app.services.input_service import init
    init()

    # any component
    from app.services.input_service import get
    get().bind(on_game_tap=self._on_tap)
"""

from app.services.input_service.input_service import InputService

_instance: InputService | None = None


def init() -> InputService:
    """Instantiate and bind the global InputService. Call once at app start."""
    global _instance
    _instance = InputService()
    return _instance


def get() -> InputService | None:
    """Return the live InputService singleton (None before init() is called)."""
    return _instance


__all__ = ["InputService", "init", "get"]
