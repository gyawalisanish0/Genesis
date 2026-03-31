"""
InputService — global input handler singleton.

Single source of truth for all raw Kivy touch/keyboard events.
Translates them into named game-level events that components and screens
subscribe to. Never call raw on_touch_* or on_key_down elsewhere.

Usage
-----
In main.py:
    from app.services.input_service import init
    init()

In any component or screen:
    from app.services.input_service import get
    get().bind(on_game_tap=self._handle_tap)
"""

import time

from kivy.core.window import Window
from kivy.event import EventDispatcher
from kivy.utils import platform

from app.core.constants import HOVER_THROTTLE_MS
from app.services.input_service.input_service_1 import InputService1
from app.services.input_service.input_service_2 import InputService2


class InputService(EventDispatcher):
    """
    EventDispatcher subclass — registers and dispatches all named game events.
    Composed of InputService1 (touch) and InputService2 (keyboard + hover).
    Instantiated once by init(); retrieved anywhere via get().
    """

    def __init__(self, **kwargs) -> None:
        self._register_events()
        super().__init__(**kwargs)
        self._touch_handler = InputService1(self)
        self._io_handler    = InputService2(self)
        self._last_hover_time: float = 0.0
        self._bind_window()

    # ── Event registration ────────────────────────────────────────────────────

    def _register_events(self) -> None:
        for event in (
            "on_game_tap",
            "on_game_double_tap",
            "on_game_long_press",
            "on_game_swipe",
            "on_game_pinch",
            "on_game_hover",
            "on_game_key",
        ):
            self.register_event_type(event)

    # ── Required default handlers (EventDispatcher contract) ─────────────────

    def on_game_tap(self, x, y):                   pass
    def on_game_double_tap(self, x, y):            pass
    def on_game_long_press(self, x, y):            pass
    def on_game_swipe(self, direction, x, y):      pass
    def on_game_pinch(self, scale_delta):          pass
    def on_game_hover(self, x, y):                 pass
    def on_game_key(self, action, key, modifiers): pass

    # ── Window bindings ───────────────────────────────────────────────────────

    def _bind_window(self) -> None:
        Window.bind(on_touch_down=self._on_touch_down)
        Window.bind(on_touch_move=self._on_touch_move)
        Window.bind(on_touch_up=self._on_touch_up)
        Window.bind(on_key_down=self._io_handler.on_keyboard_down)

        # Desktop-only: mouse hover via on_mouse_pos
        if platform in ("win", "linux", "macosx"):
            Window.bind(on_mouse_pos=self._io_handler.on_mouse_pos)

    # ── Raw event forwarding ──────────────────────────────────────────────────

    def _on_touch_down(self, window, touch) -> None:
        self._touch_handler.on_touch_down(touch)

    def _on_touch_move(self, window, touch) -> None:
        self._touch_handler.on_touch_move(touch)

    def _on_touch_up(self, window, touch) -> None:
        self._touch_handler.on_touch_up(touch)

    # ── Hover throttle (shared by touch hover + mouse pos) ───────────────────

    def _emit_hover(self, x: float, y: float) -> None:
        """Dispatch on_game_hover at most once per HOVER_THROTTLE_MS interval."""
        now_ms = time.time() * 1000
        if now_ms - self._last_hover_time >= HOVER_THROTTLE_MS:
            self._last_hover_time = now_ms
            self.dispatch("on_game_hover", x, y)
