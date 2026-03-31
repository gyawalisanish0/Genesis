"""
InputService1 — touch event processing.

Handles: tap, double-tap, long press, swipe, pinch.
All gesture classification delegates to stateless helpers in input_helpers.
"""

from kivy.clock import Clock
from kivy.metrics import dp

from app.core.constants import LONG_PRESS_DURATION_MS, SWIPE_MIN_DISTANCE_DP
from app.utils.input_helpers import (
    get_touch_distance,
    is_double_tap,
    is_hover,
    is_pinch,
    is_swipe,
    is_tap,
)


class InputService1:
    """Touch event processor — composed inside InputService."""

    def __init__(self, dispatcher) -> None:
        # dispatcher is the InputService EventDispatcher
        self._dispatcher       = dispatcher
        self._active_touches: dict = {}   # uid → touch object
        self._long_press_clocks: dict = {}  # uid → Clock event handle
        self._pinch_start_dist: float | None = None

    # ── Public entry points (called by InputService) ──────────────────────────

    def on_touch_down(self, touch) -> None:
        self._active_touches[touch.uid] = touch

        if len(self._active_touches) == 2:
            self._start_pinch()
            return

        if is_double_tap(touch):
            self._dispatcher.dispatch("on_game_double_tap", touch.x, touch.y)
            return

        delay = LONG_PRESS_DURATION_MS / 1000.0
        handle = Clock.schedule_once(lambda dt: self._fire_long_press(touch), delay)
        self._long_press_clocks[touch.uid] = handle

    def on_touch_move(self, touch) -> None:
        if len(self._active_touches) >= 2:
            self._handle_pinch()
            return

        if is_hover(touch, delta_threshold_px=3.0):
            self._dispatcher._emit_hover(touch.x, touch.y)

    def on_touch_up(self, touch) -> None:
        self._cancel_long_press(touch.uid)
        self._active_touches.pop(touch.uid, None)

        if self._pinch_start_dist is not None:
            # Finger lifted after pinch — reset reference distance
            if len(self._active_touches) < 2:
                self._pinch_start_dist = None
            return

        if is_double_tap(touch):
            return  # already dispatched in touch_down

        swipe_dir = is_swipe(touch, min_distance_px=dp(SWIPE_MIN_DISTANCE_DP))
        if swipe_dir:
            self._dispatcher.dispatch("on_game_swipe", swipe_dir, touch.x, touch.y)
        elif is_tap(touch):
            self._dispatcher.dispatch("on_game_tap", touch.x, touch.y)

    # ── Long press ────────────────────────────────────────────────────────────

    def _fire_long_press(self, touch) -> None:
        if touch.uid in self._active_touches:
            self._dispatcher.dispatch("on_game_long_press", touch.x, touch.y)

    def _cancel_long_press(self, uid) -> None:
        handle = self._long_press_clocks.pop(uid, None)
        if handle:
            handle.cancel()

    # ── Pinch ─────────────────────────────────────────────────────────────────

    def _start_pinch(self) -> None:
        touches = list(self._active_touches.values())
        self._pinch_start_dist = get_touch_distance(touches[0], touches[1])

    def _handle_pinch(self) -> None:
        if self._pinch_start_dist is None:
            return
        touches = list(self._active_touches.values())
        current_dist = get_touch_distance(touches[0], touches[1])
        scale = is_pinch(current_dist, self._pinch_start_dist)
        if scale is not None:
            self._dispatcher.dispatch("on_game_pinch", scale)
            # Update reference so subsequent moves give incremental deltas
            self._pinch_start_dist = current_dist
