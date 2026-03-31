"""
data_service package.

Public API
----------
init(data_dir)  — Load all JSON definitions and store the singleton.
                  Call once at app start (after determining the assets path).
get()           — Retrieve the live singleton from anywhere.
DataService     — The class itself (rarely needed directly).
DataLoadError   — Raised when a file cannot be read or parsed.
SchemaValidationError — Raised when a file fails schema validation.

Example
-------
    # main.py
    import os
    from app.services.data_service import init
    data_dir = os.path.join(os.path.dirname(__file__), "assets", "data")
    init(data_dir)

    # any screen or component
    from app.services.data_service import get
    warrior = get().get_character("warrior_001")
"""

from app.services.data_service.data_service import DataService
from app.services.data_service.data_service_1 import DataLoadError
from app.services.data_service.data_service_2 import SchemaValidationError

_instance: DataService | None = None


def init(data_dir: str) -> DataService:
    """Create the DataService, load all definitions, and store the singleton."""
    global _instance
    _instance = DataService(data_dir)
    _instance.load_all()
    return _instance


def get() -> DataService | None:
    """Return the live DataService singleton (None before init() is called)."""
    return _instance


__all__ = [
    "DataService",
    "DataLoadError",
    "SchemaValidationError",
    "init",
    "get",
]
