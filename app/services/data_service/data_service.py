"""
DataService — JSON definition loader, validator, and cache.

Reads every .json file under assets/data/ at startup, validates each against
its declared schema, and stores the results in an id-keyed cache.
core/ never reads files directly — it receives dicts from this service.

Usage
-----
In main.py:
    from app.services.data_service import init
    init()

Anywhere else:
    from app.services.data_service import get
    warrior = get().get_by_id("warrior_001")
    all_skills = get().get_all("skill")
"""

import os

from app.services.data_service.data_service_1 import DataLoadError, DataService1
from app.services.data_service.data_service_2 import DataService2, SchemaValidationError


class DataService:
    """
    Singleton cache for all game definition data.
    After load_all() every entity is accessible by id or by type.
    """

    def __init__(self, data_dir: str) -> None:
        self._data_dir  = data_dir
        self._loader    = DataService1()
        self._validator = DataService2()
        self._by_id: dict[str, dict]       = {}   # id → entity dict
        self._by_type: dict[str, list[dict]] = {}  # type → [entity, ...]

    # ── Loading ───────────────────────────────────────────────────────────────

    def load_all(self) -> None:
        """
        Discover, parse, validate, and cache every JSON file in data_dir.
        Raises DataLoadError or SchemaValidationError on the first bad file.
        """
        paths = self._loader.discover_files(self._data_dir)
        for path in paths:
            data = self._loader.load_json(path)
            self._validator.validate(data, path)
            self._cache(data)

    def _cache(self, data: dict) -> None:
        entity_id   = data["id"]
        entity_type = data["type"]
        self._by_id[entity_id] = data
        self._by_type.setdefault(entity_type, []).append(data)

    # ── Public lookup API ─────────────────────────────────────────────────────

    def get_by_id(self, entity_id: str) -> dict | None:
        """Return any entity by its id, or None if not found."""
        return self._by_id.get(entity_id)

    def get_all(self, entity_type: str) -> list[dict]:
        """Return all cached entities of a given type (empty list if none)."""
        return list(self._by_type.get(entity_type, []))

    def get_character(self, entity_id: str) -> dict | None:
        return self._typed_get(entity_id, "character")

    def get_skill(self, entity_id: str) -> dict | None:
        return self._typed_get(entity_id, "skill")

    def get_genesis_item(self, entity_id: str) -> dict | None:
        return self._typed_get(entity_id, "genesis_item")

    def get_campaign_item(self, entity_id: str) -> dict | None:
        return self._typed_get(entity_id, "campaign_item")

    def get_quest(self, entity_id: str) -> dict | None:
        return self._typed_get(entity_id, "quest")

    def get_mode(self, entity_id: str) -> dict | None:
        return self._typed_get(entity_id, "mode")

    def _typed_get(self, entity_id: str, expected_type: str) -> dict | None:
        """Return an entity only if its type matches expected_type."""
        entity = self._by_id.get(entity_id)
        if entity and entity["type"] == expected_type:
            return entity
        return None
