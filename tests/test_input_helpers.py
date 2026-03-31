"""
Tests for app/utils/input_helpers.py.

All helpers are pure functions — no Kivy runtime required.
We fake touch objects with simple namespaces.
"""

import math
import time
from types import SimpleNamespace

import pytest

from app.utils.input_helpers import (
    SwipeDirection,
    get_touch_distance,
    is_double_tap,
    is_hover,
    is_long_press,
    is_pinch,
    is_swipe,
    is_tap,
)


# ── Fake touch factory ────────────────────────────────────────────────────────

def make_touch(x=0.0, y=0.0, ox=0.0, oy=0.0,
               dx=0.0, dy=0.0, time_start=None,
               is_double_tap_flag=False):
    return SimpleNamespace(
        x=x, y=y,
        ox=ox, oy=oy,
        dx=dx, dy=dy,
        time_start=time_start if time_start is not None else time.time(),
        is_double_tap=is_double_tap_flag,
    )


# ── is_tap ────────────────────────────────────────────────────────────────────

def test_tap_quick_no_movement():
    touch = make_touch(x=5, y=5, ox=0, oy=0, time_start=time.time() - 0.1)
    assert is_tap(touch, max_distance_px=20, max_duration_ms=300)


def test_tap_too_slow():
    touch = make_touch(x=0, y=0, ox=0, oy=0, time_start=time.time() - 0.5)
    assert not is_tap(touch, max_distance_px=20, max_duration_ms=300)


def test_tap_too_far():
    touch = make_touch(x=100, y=100, ox=0, oy=0, time_start=time.time() - 0.1)
    assert not is_tap(touch, max_distance_px=20, max_duration_ms=300)


# ── is_long_press ─────────────────────────────────────────────────────────────

def test_long_press_held_long_enough():
    touch = make_touch(time_start=time.time() - 0.6)
    assert is_long_press(touch, duration_ms=500)


def test_long_press_not_held_long_enough():
    touch = make_touch(time_start=time.time() - 0.1)
    assert not is_long_press(touch, duration_ms=500)


# ── is_swipe ──────────────────────────────────────────────────────────────────

def test_swipe_right():
    touch = make_touch(x=100, y=0, ox=0, oy=0)
    assert is_swipe(touch, min_distance_px=50) == SwipeDirection.RIGHT


def test_swipe_left():
    touch = make_touch(x=-100, y=0, ox=0, oy=0)
    assert is_swipe(touch, min_distance_px=50) == SwipeDirection.LEFT


def test_swipe_up():
    touch = make_touch(x=0, y=100, ox=0, oy=0)
    assert is_swipe(touch, min_distance_px=50) == SwipeDirection.UP


def test_swipe_down():
    touch = make_touch(x=0, y=-100, ox=0, oy=0)
    assert is_swipe(touch, min_distance_px=50) == SwipeDirection.DOWN


def test_swipe_below_threshold_returns_none():
    touch = make_touch(x=10, y=0, ox=0, oy=0)
    assert is_swipe(touch, min_distance_px=50) is None


def test_swipe_diagonal_resolves_to_dominant_axis():
    # dx=100, dy=40 → horizontal dominates
    touch = make_touch(x=100, y=40, ox=0, oy=0)
    assert is_swipe(touch, min_distance_px=50) == SwipeDirection.RIGHT


# ── get_touch_distance ────────────────────────────────────────────────────────

def test_get_touch_distance_known_value():
    t1 = make_touch(x=0, y=0)
    t2 = make_touch(x=3, y=4)
    assert get_touch_distance(t1, t2) == pytest.approx(5.0)


def test_get_touch_distance_same_point():
    t1 = make_touch(x=10, y=10)
    t2 = make_touch(x=10, y=10)
    assert get_touch_distance(t1, t2) == pytest.approx(0.0)


# ── is_pinch ──────────────────────────────────────────────────────────────────

def test_pinch_spread_returns_scale_greater_than_one():
    scale = is_pinch(current_distance=200.0, start_distance=100.0, threshold_px=5.0)
    assert scale == pytest.approx(2.0)


def test_pinch_squeeze_returns_scale_less_than_one():
    scale = is_pinch(current_distance=50.0, start_distance=100.0, threshold_px=5.0)
    assert scale == pytest.approx(0.5)


def test_pinch_below_threshold_returns_none():
    scale = is_pinch(current_distance=103.0, start_distance=100.0, threshold_px=10.0)
    assert scale is None


def test_pinch_zero_start_distance_returns_none():
    assert is_pinch(current_distance=50.0, start_distance=0.0) is None


# ── is_double_tap ─────────────────────────────────────────────────────────────

def test_double_tap_true():
    touch = make_touch(is_double_tap_flag=True)
    assert is_double_tap(touch)


def test_double_tap_false():
    touch = make_touch(is_double_tap_flag=False)
    assert not is_double_tap(touch)


def test_double_tap_missing_attribute():
    # Touch without the attribute at all should safely return False
    touch = SimpleNamespace(x=0, y=0)
    assert not is_double_tap(touch)


# ── is_hover ──────────────────────────────────────────────────────────────────

def test_hover_stationary():
    touch = make_touch(dx=1.0, dy=0.5)
    assert is_hover(touch, delta_threshold_px=5.0)


def test_hover_moving_too_fast():
    touch = make_touch(dx=10.0, dy=0.0)
    assert not is_hover(touch, delta_threshold_px=5.0)


def test_hover_exactly_at_threshold():
    touch = make_touch(dx=5.0, dy=0.0)
    assert is_hover(touch, delta_threshold_px=5.0)


def test_hover_negative_delta():
    touch = make_touch(dx=-3.0, dy=-3.0)
    assert is_hover(touch, delta_threshold_px=5.0)
