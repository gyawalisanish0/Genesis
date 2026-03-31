from app.core.constants import DICE_BASE_PROBABILITIES

# Positive outcomes — scaled up when hit chance > 1.0, down when < 1.0
_POSITIVE = ("Boosted", "Success")
# Negative outcomes — receive the remainder after positive pool is set
_NEGATIVE = ("Tumbling", "GuardUp", "Evasion")

_POSITIVE_BASE = sum(DICE_BASE_PROBABILITIES[k] for k in _POSITIVE)  # 0.60
_NEGATIVE_BASE = sum(DICE_BASE_PROBABILITIES[k] for k in _NEGATIVE)  # 0.40


class HitChanceEvaluator:
    """Converts Precision + base skill chance into a shifted probability table."""

    def calculate_final_chance(self, precision: int, base_chance: float) -> float:
        """
        Final chance = precision × base_chance.
        precision is a unit stat (0–100 maps to 0.0–1.0 multiplier range).
        base_chance is skill-defined (0.01–1.50 per CONCEPT.md).
        Result can exceed 1.0 — the excess shifts the dice table, not a cap.
        """
        return (precision / 100.0) * base_chance

    def shift_probabilities(self, final_chance: float) -> dict:
        """
        Shift the base dice probability table using final_chance as a ratio.

        Strategy:
        - Scale the positive pool (Boosted + Success) by final_chance, capped at 0.99.
        - The negative pool (Tumbling + GuardUp + Evasion) receives the complement.
        - Redistribute within each pool proportionally to preserve relative weights.
        - Result always sums to 1.0.
        """
        positive_total = min(0.99, _POSITIVE_BASE * final_chance)
        negative_total = 1.0 - positive_total

        shifted = {}
        shifted = self._distribute_pool(shifted, _POSITIVE, positive_total)
        shifted = self._distribute_pool(shifted, _NEGATIVE, negative_total)
        return shifted

    def _distribute_pool(self, shifted: dict, outcomes: tuple, pool_total: float) -> dict:
        """Scale a group of outcomes proportionally to fill pool_total."""
        group_base = sum(DICE_BASE_PROBABILITIES[k] for k in outcomes)
        for key in outcomes:
            weight = DICE_BASE_PROBABILITIES[key] / group_base
            shifted[key] = pool_total * weight
        return shifted
