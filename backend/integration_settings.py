"""Persistent settings for optional integrations."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from config import settings


_DATA_DIR = Path(os.environ.get("DENON_DASHBOARD_DATA_DIR", "/data"))
_SETTINGS_PATH = _DATA_DIR / "integration_settings.json"


def _load() -> dict[str, Any]:
    try:
        data = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return {}


def _save(data: dict[str, Any]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_path = _SETTINGS_PATH.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    temporary_path.replace(_SETTINGS_PATH)


def navidrome_settings() -> dict[str, str]:
    """Return persisted values, falling back to environment configuration."""
    persisted = _load().get("navidrome", {})
    if not isinstance(persisted, dict):
        persisted = {}
    return {
        "url": str(persisted.get("url", settings.navidrome_url)),
        "username": str(persisted.get("username", settings.navidrome_username)),
        "password": str(persisted.get("password", settings.navidrome_password)),
    }


def save_navidrome_settings(url: str, username: str, password: str | None) -> None:
    current = _load()
    previous = navidrome_settings()
    current["navidrome"] = {
        "url": url.strip().rstrip("/"),
        "username": username.strip(),
        "password": previous["password"] if password in (None, "") else password,
    }
    _save(current)
