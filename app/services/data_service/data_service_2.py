"""
DataService2 — schema definitions and validation.

Every entity type has a strict schema: required fields, optional fields, and
expected Python types. Unknown fields are rejected. Nested stat blocks on
character entities are validated separately.
"""

from app.core.constants import CLASS_TICK_RANGES

# Valid stat names — used in both character stat blocks and skill stat_key fields
_STAT_NAMES = frozenset(
    {"strength", "endurance", "power", "resistance", "speed", "precision"}
)

# Valid class names — sourced from constants so the two never diverge
_CLASS_NAMES = frozenset(CLASS_TICK_RANGES.keys())

# ── Schema definitions ────────────────────────────────────────────────────────
# Each schema lists required fields, optional fields, and expected Python types.
# type(None) represents null/None in JSON.

_SCHEMAS: dict[str, dict] = {
    "character": {
        "required": {"type", "id", "name", "class_name", "rarity",
                     "stats", "max_hp", "max_ap", "ap_regen_rate"},
        "optional": {"passive", "skill_path", "secondary_resource"},
        "types": {
            "type": str, "id": str, "name": str,
            "class_name": str, "rarity": int, "stats": dict,
            "max_hp": int, "max_ap": (int, float),
            "ap_regen_rate": (int, float),
            "passive": (str, type(None)),
            "skill_path": str,
            "secondary_resource": (str, type(None)),
        },
    },
    "skill": {
        "required": {"type", "id", "name", "tu_cost", "ap_cost",
                     "base_chance", "base_value", "stat_key",
                     "max_level", "tags", "level_upgrades"},
        "optional": {"description"},
        "types": {
            "type": str, "id": str, "name": str, "description": str,
            "tu_cost": int, "ap_cost": (int, float),
            "base_chance": (int, float), "base_value": int,
            "stat_key": str, "max_level": int,
            "tags": list, "level_upgrades": list,
        },
    },
    "genesis_item": {
        "required": {"type", "id", "name", "slot", "effects"},
        "optional": {"description"},
        "types": {
            "type": str, "id": str, "name": str, "description": str,
            "slot": str, "effects": list,
        },
    },
    "campaign_item": {
        "required": {"type", "id", "name", "item_type", "effects"},
        "optional": {"description"},
        "types": {
            "type": str, "id": str, "name": str, "description": str,
            "item_type": str, "effects": list,
        },
    },
    "quest": {
        "required": {"type", "id", "name", "description", "objectives", "reward"},
        "optional": set(),
        "types": {
            "type": str, "id": str, "name": str, "description": str,
            "objectives": list, "reward": dict,
        },
    },
    "mode": {
        "required": {"type", "id", "name", "description", "settings"},
        "optional": set(),
        "types": {
            "type": str, "id": str, "name": str,
            "description": str, "settings": dict,
        },
    },
}


class SchemaValidationError(Exception):
    """Raised when a data file fails schema validation."""


class DataService2:
    """Schema validator — composed inside DataService."""

    def validate(self, data: dict, source_path: str) -> None:
        """
        Validate a parsed JSON dict against its declared schema.
        Raises SchemaValidationError with a descriptive message on any violation.
        Unknown fields are rejected; missing required fields are rejected.
        """
        entity_type = data.get("type")
        if not entity_type:
            raise SchemaValidationError(f"{source_path}: missing 'type' field")

        schema = _SCHEMAS.get(entity_type)
        if schema is None:
            raise SchemaValidationError(
                f"{source_path}: unknown entity type '{entity_type}'"
            )

        allowed = schema["required"] | schema["optional"]
        self._check_unknown_fields(data, allowed, source_path)
        self._check_required_fields(data, schema["required"], source_path)
        self._check_field_types(data, schema["types"], source_path)

        if entity_type == "character":
            self._validate_character_extras(data, source_path)
        if entity_type == "skill":
            self._validate_skill_extras(data, source_path)

    # ── Field-level checks ────────────────────────────────────────────────────

    def _check_unknown_fields(self, data: dict, allowed: set, path: str) -> None:
        unknown = set(data.keys()) - allowed
        if unknown:
            raise SchemaValidationError(
                f"{path}: unknown field(s): {sorted(unknown)}"
            )

    def _check_required_fields(self, data: dict, required: set, path: str) -> None:
        missing = required - set(data.keys())
        if missing:
            raise SchemaValidationError(
                f"{path}: missing required field(s): {sorted(missing)}"
            )

    def _check_field_types(self, data: dict, types: dict, path: str) -> None:
        for field, expected in types.items():
            if field not in data:
                continue  # optional field absent — already checked above
            if not isinstance(data[field], expected):
                raise SchemaValidationError(
                    f"{path}: field '{field}' must be {expected}, "
                    f"got {type(data[field]).__name__}"
                )

    # ── Entity-specific extra validation ──────────────────────────────────────

    def _validate_character_extras(self, data: dict, path: str) -> None:
        if data["class_name"] not in _CLASS_NAMES:
            raise SchemaValidationError(
                f"{path}: unknown class_name '{data['class_name']}'; "
                f"valid classes: {sorted(_CLASS_NAMES)}"
            )
        self._validate_stat_block(data["stats"], path)

    def _validate_stat_block(self, stats: dict, path: str) -> None:
        unknown = set(stats.keys()) - _STAT_NAMES
        if unknown:
            raise SchemaValidationError(
                f"{path}: unknown stat(s) in stats block: {sorted(unknown)}"
            )
        missing = _STAT_NAMES - set(stats.keys())
        if missing:
            raise SchemaValidationError(
                f"{path}: missing stat(s) in stats block: {sorted(missing)}"
            )
        for stat, value in stats.items():
            if not isinstance(value, int):
                raise SchemaValidationError(
                    f"{path}: stat '{stat}' must be int, got {type(value).__name__}"
                )

    def _validate_skill_extras(self, data: dict, path: str) -> None:
        if data["stat_key"] not in _STAT_NAMES:
            raise SchemaValidationError(
                f"{path}: unknown stat_key '{data['stat_key']}'; "
                f"valid stats: {sorted(_STAT_NAMES)}"
            )
        if not (0.01 <= data["base_chance"] <= 1.50):
            raise SchemaValidationError(
                f"{path}: base_chance {data['base_chance']} out of range [0.01, 1.50]"
            )
