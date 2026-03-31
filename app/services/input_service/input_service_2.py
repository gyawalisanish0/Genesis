"""
InputService2 — keyboard and desktop hover processing.

Keyboard: maps raw Kivy key codes to named game actions and dispatches
          on_game_key events.
Hover:    on_mouse_pos fires on desktop when no button is pressed;
          the dispatcher's throttled _emit_hover handles deduplication.
"""

# Kivy key code → named game action
_KEY_ACTION_MAP: dict[int, str] = {
    13:  "confirm",   # Enter / Return
    27:  "cancel",    # Escape
    32:  "attack",    # Space
    273: "up",        # Arrow Up
    274: "down",      # Arrow Down
    275: "right",     # Arrow Right
    276: "left",      # Arrow Left
}


class InputService2:
    """Keyboard and desktop hover processor — composed inside InputService."""

    def __init__(self, dispatcher) -> None:
        self._dispatcher = dispatcher

    # ── Keyboard ──────────────────────────────────────────────────────────────

    def on_keyboard_down(self, window, key, scancode, codepoint, modifiers) -> None:
        """Translate a raw key press into a named game action and dispatch it."""
        action = _KEY_ACTION_MAP.get(key)
        if action:
            self._dispatcher.dispatch("on_game_key", action, key, modifiers)

    # ── Desktop hover ─────────────────────────────────────────────────────────

    def on_mouse_pos(self, window, pos) -> None:
        """
        Fires on desktop when the mouse pointer moves (no button pressed).
        Delegates to the throttled hover emitter on the dispatcher.
        """
        self._dispatcher._emit_hover(pos[0], pos[1])
