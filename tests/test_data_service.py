"""
Tests for app/services/data_service/.

Happy-path tests use the real fixture files in assets/data/.
Validation tests write minimal JSON to a tmp_path directory.
"""

import json
import os

import pytest

from app.services.data_service import DataLoadError, DataService, SchemaValidationError
from app.services.data_service.data_service_1 import DataService1
from app.services.data_service.data_service_2 import DataService2

# Path to the real fixture data shipped with the project
_ASSETS_DATA = os.path.join(
    os.path.dirname(__file__), "..", "assets", "data"
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_service(data_dir: str) -> DataService:
    svc = DataService(data_dir)
    svc.load_all()
    return svc


def write_json(directory: str, filename: str, data: dict) -> str:
    path = os.path.join(directory, filename)
    with open(path, "w") as fh:
        json.dump(data, fh)
    return path


# ── DataService1 — file loader ────────────────────────────────────────────────

class TestDataService1:
    loader = DataService1()

    def test_discover_finds_all_json_fixtures(self):
        paths = self.loader.discover_files(_ASSETS_DATA)
        assert len(paths) >= 6  # 2 chars + 2 skills + 2 modes

    def test_discover_returns_sorted_paths(self):
        paths = self.loader.discover_files(_ASSETS_DATA)
        assert paths == sorted(paths)

    def test_load_json_parses_correctly(self, tmp_path):
        path = write_json(str(tmp_path), "test.json", {"key": "value"})
        data = self.loader.load_json(path)
        assert data == {"key": "value"}

    def test_load_json_raises_on_missing_file(self):
        with pytest.raises(DataLoadError, match="not found"):
            self.loader.load_json("/no/such/file.json")

    def test_load_json_raises_on_invalid_json(self, tmp_path):
        bad = tmp_path / "bad.json"
        bad.write_text("{ not valid json }")
        with pytest.raises(DataLoadError, match="Invalid JSON"):
            self.loader.load_json(str(bad))


# ── DataService2 — schema validator ───────────────────────────────────────────

class TestDataService2:
    v = DataService2()

    # ── Character ──────────────────────────────────────────────────────────────

    def _valid_character(self):
        return {
            "type": "character", "id": "x", "name": "X",
            "class_name": "Warrior", "rarity": 1,
            "stats": {k: 50 for k in
                      ("strength", "endurance", "power",
                       "resistance", "speed", "precision")},
            "max_hp": 1000, "max_ap": 100.0, "ap_regen_rate": 5.0,
        }

    def test_valid_character_passes(self):
        self.v.validate(self._valid_character(), "test.json")  # no raise

    def test_unknown_field_rejected(self):
        data = self._valid_character()
        data["secret"] = 99
        with pytest.raises(SchemaValidationError, match="unknown field"):
            self.v.validate(data, "test.json")

    def test_missing_required_field_rejected(self):
        data = self._valid_character()
        del data["max_hp"]
        with pytest.raises(SchemaValidationError, match="missing required"):
            self.v.validate(data, "test.json")

    def test_wrong_type_rejected(self):
        data = self._valid_character()
        data["rarity"] = "three"  # must be int
        with pytest.raises(SchemaValidationError, match="rarity"):
            self.v.validate(data, "test.json")

    def test_unknown_class_name_rejected(self):
        data = self._valid_character()
        data["class_name"] = "Paladin"
        with pytest.raises(SchemaValidationError, match="class_name"):
            self.v.validate(data, "test.json")

    def test_unknown_stat_in_block_rejected(self):
        data = self._valid_character()
        data["stats"]["luck"] = 10
        with pytest.raises(SchemaValidationError, match="stat"):
            self.v.validate(data, "test.json")

    def test_missing_stat_in_block_rejected(self):
        data = self._valid_character()
        del data["stats"]["speed"]
        with pytest.raises(SchemaValidationError, match="stat"):
            self.v.validate(data, "test.json")

    def test_stat_wrong_type_rejected(self):
        data = self._valid_character()
        data["stats"]["strength"] = 75.5  # must be int
        with pytest.raises(SchemaValidationError, match="strength"):
            self.v.validate(data, "test.json")

    # ── Skill ─────────────────────────────────────────────────────────────────

    def _valid_skill(self):
        return {
            "type": "skill", "id": "s", "name": "S",
            "tu_cost": 8, "ap_cost": 20.0,
            "base_chance": 1.0, "base_value": 80,
            "stat_key": "strength", "max_level": 5,
            "tags": [], "level_upgrades": [],
        }

    def test_valid_skill_passes(self):
        self.v.validate(self._valid_skill(), "test.json")

    def test_skill_invalid_stat_key_rejected(self):
        data = self._valid_skill()
        data["stat_key"] = "luck"
        with pytest.raises(SchemaValidationError, match="stat_key"):
            self.v.validate(data, "test.json")

    def test_skill_base_chance_too_low_rejected(self):
        data = self._valid_skill()
        data["base_chance"] = 0.005
        with pytest.raises(SchemaValidationError, match="base_chance"):
            self.v.validate(data, "test.json")

    def test_skill_base_chance_too_high_rejected(self):
        data = self._valid_skill()
        data["base_chance"] = 1.51
        with pytest.raises(SchemaValidationError, match="base_chance"):
            self.v.validate(data, "test.json")

    # ── Unknown type ──────────────────────────────────────────────────────────

    def test_missing_type_field_rejected(self):
        with pytest.raises(SchemaValidationError, match="missing 'type'"):
            self.v.validate({"id": "x"}, "test.json")

    def test_unknown_type_rejected(self):
        with pytest.raises(SchemaValidationError, match="unknown entity type"):
            self.v.validate({"type": "dragon", "id": "x"}, "test.json")


# ── DataService — integration (real fixture files) ────────────────────────────

class TestDataServiceIntegration:

    @pytest.fixture(scope="class")
    def svc(self):
        return make_service(_ASSETS_DATA)

    def test_load_all_succeeds(self, svc):
        # If load_all raised, the fixture itself would fail
        assert svc is not None

    def test_get_character_by_id(self, svc):
        char = svc.get_character("warrior_001")
        assert char is not None
        assert char["name"] == "Iron Warden"
        assert char["class_name"] == "Warrior"

    def test_get_all_characters(self, svc):
        chars = svc.get_all("character")
        ids = [c["id"] for c in chars]
        assert "warrior_001" in ids
        assert "hunter_001" in ids

    def test_get_skill_by_id(self, svc):
        skill = svc.get_skill("slash_001")
        assert skill is not None
        assert skill["stat_key"] == "strength"

    def test_get_all_skills(self, svc):
        skills = svc.get_all("skill")
        assert len(skills) >= 2

    def test_get_mode(self, svc):
        mode = svc.get_mode("story")
        assert mode is not None
        assert mode["name"] == "Story Mode"

    def test_get_by_id_generic(self, svc):
        assert svc.get_by_id("arcane_bolt_001") is not None

    def test_get_by_id_missing_returns_none(self, svc):
        assert svc.get_by_id("does_not_exist") is None

    def test_typed_get_wrong_type_returns_none(self, svc):
        # warrior_001 is a character — get_skill should return None
        assert svc.get_skill("warrior_001") is None

    def test_get_all_unknown_type_returns_empty(self, svc):
        assert svc.get_all("dragon") == []

    # ── load_all rejects bad files ────────────────────────────────────────────

    def test_load_all_rejects_bad_json(self, tmp_path):
        bad = tmp_path / "bad.json"
        bad.write_text("not json")
        svc = DataService(str(tmp_path))
        with pytest.raises(DataLoadError):
            svc.load_all()

    def test_load_all_rejects_schema_violation(self, tmp_path):
        write_json(str(tmp_path), "bad_char.json", {
            "type": "character",
            "id": "x",
            "unknown_field": True,
        })
        svc = DataService(str(tmp_path))
        with pytest.raises(SchemaValidationError):
            svc.load_all()
