"""
Stateless gesture detection helpers.

Every function receives raw touch/event data and returns a result — no side
effects, no imports from Kivy. Consumed exclusively by InputService.
"""

import math
import time
from enum import Enum


class SwipeDirection(Enum):
    UP    = "up"
    DOWN  = "down"
    LEFT  = "left"
    RIGHT = "right"


def is_tap(touch, max_distance_px: float = 20.0, max_duration_ms: float = 300.0) -> bool:
    """
    True if the touch ended quickly with minimal total movement.
    Call at on_touch_up; uses touch.ox/oy (original position) and time_start.
    """
    elapsed_ms = (time.time() - touch.time_start) * 1000
    distance = math.sqrt((touch.x - touch.ox) ** 2 + (touch.y - touch.oy) ** 2)
    return elapsed_ms <= max_duration_ms and distance <= max_distance_px


def is_long_press(touch, duration_ms: float) -> bool:
    """
    True if the touch has been held for at least duration_ms milliseconds.
    Intended to be called from a scheduled Clock callback, not at touch_up.
    """
    elapsed_ms = (time.time() - touch.time_start) * 1000
    return elapsed_ms >= duration_ms


def is_swipe(touch, min_distance_px: float) -> SwipeDirection | None:
    """
    Returns the dominant swipe direction when total displacement exceeds
    min_distance_px, otherwise None.
    Call at on_touch_up; uses touch.ox/oy (original position).
    """
    dx = touch.x - touch.ox
    dy = touch.y - touch.oy
    distance = math.sqrt(dx ** 2 + dy ** 2)
    if distance < min_distance_px:
        return None
    if abs(dx) >= abs(dy):
        return SwipeDirection.RIGHT if dx > 0 else SwipeDirection.LEFT
    return SwipeDirection.UP if dy > 0 else SwipeDirection.DOWN


def get_touch_distance(t1, t2) -> float:
    """Euclidean distance between two touch points."""
    return math.sqrt((t1.x - t2.x) ** 2 + (t1.y - t2.y) ** 2)


def is_pinch(current_distance: float, start_distance: float,
             threshold_px: float = 10.0) -> float | None:
    """
    Returns the scale ratio (current / start) when the distance change exceeds
    threshold_px, otherwise None.

    > 1.0 = spread (zoom in)   < 1.0 = squeeze (zoom out)

    The caller should update its stored start_distance to current_distance after
    a pinch fires, so subsequent moves produce smooth incremental deltas.
    """
    if start_distance == 0:
        return None
    if abs(current_distance - start_distance) < threshold_px:
        return None
    return current_distance / start_distance


def is_double_tap(touch) -> bool:
    """True if Kivy flagged this touch as a double-tap."""
    return bool(getattr(touch, "is_double_tap", False))


def is_hover(touch, delta_threshold_px: float = 5.0) -> bool:
    """
    True when a contact is stationary (near-zero movement delta).

    Covers touch, stylus, and finger-held-still on mobile via on_touch_move
    with near-zero dx/dy.  Desktop mouse hover (on_mouse_pos) is handled
    directly in InputService2 — callers need no platform checks.
    """
    return abs(touch.dx) <= delta_threshold_px and abs(touch.dy) <= delta_threshold_px
