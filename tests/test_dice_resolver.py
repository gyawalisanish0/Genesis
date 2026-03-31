import random
from collections import Counter

import pytest

from app.core.combat.dice_resolver import DiceOutcome, DiceResolver
from app.core.constants import (
    BOOSTED_MULTIPLIER,
    EVASION_COUNTER_BASE,
    EVASION_COUNTER_MIN,
    EVASION_COUNTER_STEP,
    GUARD_UP_MITIGATION,
    TUMBLING_DELAY_MAX,
    TUMBLING_DELAY_MIN,
    TUMBLING_MULTIPLIER,
)

resolver = DiceResolver()

_FULL_PROBS = {
    "Boosted":  0.15,
    "Success":  0.45,
    "Tumbling": 0.10,
    "GuardUp":  0.20,
    "Evasion":  0.10,
}


# ── Roll distribution ─────────────────────────────────────────────────────────

def test_roll_returns_valid_outcome():
    for _ in range(100):
        outcome = resolver.roll(_FULL_PROBS)
        assert isinstance(outcome, DiceOutcome)


def test_roll_distribution_roughly_matches_weights():
    """
    With 10,000 rolls the empirical frequencies should be within ±5%
    of the declared weights.
    """
    random.seed(0)
    n = 10_000
    counts = Counter(resolver.roll(_FULL_PROBS).value for _ in range(n))
    for name, expected in _FULL_PROBS.items():
        actual = counts[name] / n
        assert abs(actual - expected) < 0.05, (
            f"{name}: expected ~{expected:.2f}, got {actual:.2f}"
        )


# ── Apply outcome ─────────────────────────────────────────────────────────────

def test_boosted_multiplies_output():
    result = resolver.apply_outcome(DiceOutcome.BOOSTED, 100)
    assert result["output"] == round(100 * BOOSTED_MULTIPLIER)
    assert result["evaded"] is False


def test_success_returns_raw_output():
    result = resolver.apply_outcome(DiceOutcome.SUCCESS, 80)
    assert result["output"] == 80
    assert result["evaded"] is False


def test_tumbling_halves_output_and_sets_delay():
    random.seed(7)
    result = resolver.apply_outcome(DiceOutcome.TUMBLING, 60)
    assert result["output"] == round(60 * TUMBLING_MULTIPLIER)
    assert TUMBLING_DELAY_MIN <= result["tumble_delay"] <= TUMBLING_DELAY_MAX
    assert result["evaded"] is False


def test_guard_up_sets_mitigation():
    result = resolver.apply_outcome(DiceOutcome.GUARD_UP, 200)
    assert result["output"] == 200
    assert result["guard_mitigation"] == round(200 * GUARD_UP_MITIGATION)
    assert result["evaded"] is False


def test_evasion_sets_evaded_flag():
    result = resolver.apply_outcome(DiceOutcome.EVASION, 100)
    assert result["evaded"] is True
    assert result["output"] == 0


# ── Tumbling delay range ──────────────────────────────────────────────────────

def test_tumbling_delay_always_in_range():
    for _ in range(200):
        delay = resolver.calculate_tumbling_delay()
        assert TUMBLING_DELAY_MIN <= delay <= TUMBLING_DELAY_MAX


# ── Evasion counter recursion ─────────────────────────────────────────────────

def test_evasion_counter_chance_decrements_with_depth():
    """Counter chance = BASE − depth × STEP, floored at MIN."""
    for depth in range(5):
        expected = max(EVASION_COUNTER_MIN,
                       EVASION_COUNTER_BASE - depth * EVASION_COUNTER_STEP)
        # Run enough trials to confirm the rate is approximately correct
        random.seed(depth * 100)
        hits = sum(1 for _ in range(2000) if resolver.resolve_evasion_counter(depth))
        actual_rate = hits / 2000
        assert abs(actual_rate - expected) < 0.05, (
            f"depth {depth}: expected ~{expected:.2f}, got {actual_rate:.2f}"
        )


def test_evasion_counter_never_below_min():
    """Even at extreme depth the counter chance never drops below EVASION_COUNTER_MIN."""
    random.seed(99)
    # depth 100 would make the raw chance deeply negative — floor must hold
    hits = sum(1 for _ in range(5000) if resolver.resolve_evasion_counter(100))
    rate = hits / 5000
    assert rate >= EVASION_COUNTER_MIN - 0.02  # generous tolerance for RNG variance
