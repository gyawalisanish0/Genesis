"""
DataService1 — file discovery and JSON loading.

Responsible for walking the data directory tree and returning raw parsed dicts.
Raises DataLoadError on any file system or JSON parsing failure.
"""

import json
import os


class DataLoadError(Exception):
    """Raised when a data file cannot be found or parsed."""


class DataService1:
    """File loader — composed inside DataService."""

    def discover_files(self, data_dir: str) -> list[str]:
        """
        Recursively collect all .json file paths under data_dir.
        Returns absolute paths sorted for deterministic ordering.
        """
        found = []
        for root, _, filenames in os.walk(data_dir):
            for filename in filenames:
                if filename.endswith(".json"):
                    found.append(os.path.join(root, filename))
        return sorted(found)

    def load_json(self, path: str) -> dict:
        """
        Read and parse a single JSON file.
        Raises DataLoadError if the file is missing or contains invalid JSON.
        """
        try:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        except FileNotFoundError:
            raise DataLoadError(f"Data file not found: {path}")
        except json.JSONDecodeError as exc:
            raise DataLoadError(f"Invalid JSON in {path}: {exc}")
