from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)
DOTENV_VALUES = dotenv_values(dotenv_path=ENV_PATH)


def _read_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is not None:
        cleaned = value.strip().lstrip("\ufeff")
        if cleaned:
            return cleaned

    value = DOTENV_VALUES.get(name)
    if value is not None:
        cleaned = value.strip().lstrip("\ufeff")
        if cleaned:
            return cleaned

    return default


OPENAI_MODEL = _read_env("OPENAI_MODEL", "gpt-5.6-luna")
DATABASE_PATH = _read_env("DATABASE_PATH", "data/app.db")


def get_openai_api_key() -> str | None:
    return _read_env("OPENAI_API_KEY")
