from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from dotenv import dotenv_values, load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"
DEFAULT_OPENAI_MODEL = "gpt-5.6-luna"
AVAILABLE_OPENAI_MODELS = [
    "gpt-5.6-luna",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5",
]
MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]+$")

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


DATABASE_PATH = _read_env("DATABASE_PATH", "data/app.db")


def get_openai_model() -> str:
    return _read_env("OPENAI_MODEL", DEFAULT_OPENAI_MODEL) or DEFAULT_OPENAI_MODEL


def get_openai_api_key() -> str | None:
    return _read_env("OPENAI_API_KEY")


def read_openai_settings() -> dict[str, Any]:
    api_key = get_openai_api_key()
    return {
        "api_key_configured": bool(api_key),
        "api_key_preview": _mask_secret(api_key),
        "model": get_openai_model(),
        "available_models": AVAILABLE_OPENAI_MODELS,
    }


def update_openai_settings(api_key: str | None, model: str) -> dict[str, Any]:
    cleaned_model = model.strip()
    if not cleaned_model or not MODEL_ID_PATTERN.match(cleaned_model):
        raise ValueError("Model must be a non-empty OpenAI model id.")

    existing_values = dict(DOTENV_VALUES)
    current_key = get_openai_api_key()
    cleaned_key = (api_key or "").strip()

    if cleaned_key:
        existing_values["OPENAI_API_KEY"] = cleaned_key
    elif current_key:
        existing_values["OPENAI_API_KEY"] = current_key
    else:
        existing_values["OPENAI_API_KEY"] = ""

    existing_values["OPENAI_MODEL"] = cleaned_model
    existing_values["DATABASE_PATH"] = existing_values.get("DATABASE_PATH") or DATABASE_PATH or "data/app.db"

    _write_env_file(existing_values)
    os.environ["OPENAI_MODEL"] = cleaned_model
    if cleaned_key:
        os.environ["OPENAI_API_KEY"] = cleaned_key
    _reload_dotenv_values()
    return read_openai_settings()


def _mask_secret(value: str | None) -> str:
    if not value:
        return ""
    if len(value) <= 12:
        return f"{value[:4]}..."
    return f"{value[:7]}...{value[-4:]}"


def _write_env_file(values: dict[str, Any]) -> None:
    ordered_keys = ["OPENAI_API_KEY", "OPENAI_MODEL", "DATABASE_PATH"]
    lines: list[str] = []

    for key in ordered_keys:
        if key in values:
            lines.append(f"{key}={values[key] or ''}")

    for key, value in values.items():
        if key not in ordered_keys:
            lines.append(f"{key}={value or ''}")

    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _reload_dotenv_values() -> None:
    global DOTENV_VALUES
    DOTENV_VALUES = dotenv_values(dotenv_path=ENV_PATH)
