import pytest

from app.core.combat.hit_chance_evaluator import HitChanceEvaluator

evaluator = HitChanceEvaluator()


# ── calculate_final_chance ────────────────────────────────────────────────────

def test_final_chance_basic():
    # precision 100 → 1.0 multiplier; base_chance 1.0 → final = 1.0
    assert evaluator.calculate_final_chance(100, 1.0) == pytest.approx(1.0)


def test_final_chance_half_precision():
    # precision 50 → 0.5 × base_chance
    assert evaluator.calculate_final_chance(50, 1.0) == pytest.approx(0.5)


def test_final_chance_can_exceed_one():
    # precision 100, base_chance 1.5 → 1.5 (skill with high base is allowed)
    assert evaluator.calculate_final_chance(100, 1.5) == pytest.approx(1.5)


def test_final_chance_zero_precision():
    assert evaluator.calculate_final_chance(0, 1.0) == pytest.approx(0.0)


# ── shift_probabilities ───────────────────────────────────────────────────────

def test_shifted_probs_always_sum_to_one():
    for chance in (0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0):
        shifted = evaluator.shift_probabilities(chance)
        total = sum(shifted.values())
        assert total == pytest.approx(1.0, abs=1e-9), (
            f"final_chance={chance}: sum={total}"
        )


def test_high_final_chance_biases_positive():
    """final_chance > 1.0 should give Boosted + Success more than base 0.60."""
    shifted = evaluator.shift_probabilities(1.5)
    positive = shifted["Boosted"] + shifted["Success"]
    assert positive > 0.60


def test_low_final_chance_biases_negative():
    """final_chance < 1.0 should give Boosted + Success less than base 0.60."""
    shifted = evaluator.shift_probabilities(0.5)
    positive = shifted["Boosted"] + shifted["Success"]
    assert positive < 0.60


def test_full_chance_matches_base_probabilities():
    """At final_chance = 1.0 the table should match base probabilities exactly."""
    from app.core.constants import DICE_BASE_PROBABILITIES
    shifted = evaluator.shift_probabilities(1.0)
    for key, base in DICE_BASE_PROBABILITIES.items():
        assert shifted[key] == pytest.approx(base, abs=1e-9), (
            f"{key}: expected {base}, got {shifted[key]}"
        )


def test_positive_pool_capped_at_0_99():
    """Even with extreme final_chance the positive pool must not reach 1.0."""
    shifted = evaluator.shift_probabilities(100.0)
    positive = shifted["Boosted"] + shifted["Success"]
    assert positive <= 0.99


def test_all_outcomes_present_in_shifted_table():
    shifted = evaluator.shift_probabilities(1.0)
    for key in ("Boosted", "Success", "Tumbling", "GuardUp", "Evasion"):
        assert key in shifted


def test_relative_weights_preserved_within_positive_pool():
    """
    Within the positive pool, Boosted:Success ratio must stay ~0.15:0.45 = 1:3
    regardless of final_chance scaling.
    """
    for chance in (0.5, 1.0, 1.5):
        shifted = evaluator.shift_probabilities(chance)
        ratio = shifted["Boosted"] / shifted["Success"]
        assert ratio == pytest.approx(0.15 / 0.45, rel=1e-6)
