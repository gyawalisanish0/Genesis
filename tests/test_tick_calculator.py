import random

import pytest

from app.core.combat.tick_calculator import TickCalculator
from app.core.constants import CLASS_TICK_RANGES

calc = TickCalculator()


# ── Starting tick ────────────────────────────────────────────────────────────

def test_speed_100_always_returns_class_min():
    """Max Speed unit always lands at class_min (zero random offset)."""
    for class_name, (class_min, _) in CLASS_TICK_RANGES.items():
        for _ in range(50):  # repeat to confirm determinism
            tick = calc.calculate_starting_tick(100, class_name)
            assert tick == class_min, (
                f"{class_name}: expected {class_min}, got {tick}"
            )


def test_speed_0_stays_within_full_class_range():
    """Min Speed unit always lands within [class_min, class_max]."""
    for class_name, (class_min, class_max) in CLASS_TICK_RANGES.items():
        for _ in range(200):
            tick = calc.calculate_starting_tick(0, class_name)
            assert class_min <= tick <= class_max, (
                f"{class_name}: tick {tick} outside [{class_min}, {class_max}]"
            )


def test_speed_50_ceiling_is_midpoint():
    """Speed 50 compresses the ceiling to class_min + half the range."""
    random.seed(42)
    class_name = "Guardian"
    class_min, class_max = CLASS_TICK_RANGES[class_name]
    expected_max = class_min + round((class_max - class_min) * 0.5)

    for _ in range(500):
        tick = calc.calculate_starting_tick(50, class_name)
        assert tick <= expected_max, (
            f"Speed 50 tick {tick} exceeded expected ceiling {expected_max}"
        )


def test_unknown_class_raises():
    with pytest.raises(KeyError):
        calc.calculate_starting_tick(50, "Paladin")


# ── Advance tick ─────────────────────────────────────────────────────────────

def test_advance_tick_adds_tu_cost():
    assert calc.advance_tick(5, 3)  == 8
    assert calc.advance_tick(0, 10) == 10
    assert calc.advance_tick(20, 0) == 20


# ── AP regen ─────────────────────────────────────────────────────────────────

def test_ap_gained_is_ticks_times_rate():
    assert calc.calculate_ap_gained(5, 2.0)  == 10.0
    assert calc.calculate_ap_gained(0, 5.0)  == 0.0
    assert calc.calculate_ap_gained(3, 0.0)  == 0.0
    assert calc.calculate_ap_gained(4, 1.5)  == 6.0
