from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from dotenv import dotenv_values, load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"
DEFAULT_OPENAI_MODEL = "gpt-5.6-luna"
DEFAULT_OPENAI_KEY_SOURCE = "default"
DEFAULT_DEBATE_MODE = "api"
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
KEY_SOURCES = ["default", "user"]
DEBATE_MODES = ["api", "demo"]

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


def get_openai_key_source() -> str:
    key_source = _read_env("OPENAI_KEY_SOURCE", DEFAULT_OPENAI_KEY_SOURCE) or DEFAULT_OPENAI_KEY_SOURCE
    return key_source if key_source in KEY_SOURCES else DEFAULT_OPENAI_KEY_SOURCE


def get_debate_mode() -> str:
    debate_mode = _read_env("OPENAI_DEBATE_MODE", DEFAULT_DEBATE_MODE) or DEFAULT_DEBATE_MODE
    return debate_mode if debate_mode in DEBATE_MODES else DEFAULT_DEBATE_MODE


def get_openai_api_key() -> str | None:
    if get_openai_key_source() == "user":
        return _read_env("OPENAI_USER_API_KEY") or _read_env("OPENAI_API_KEY")
    return _read_env("OPENAI_API_KEY")


def read_openai_settings() -> dict[str, Any]:
    default_key = _read_env("OPENAI_API_KEY")
    user_key = _read_env("OPENAI_USER_API_KEY")
    api_key = get_openai_api_key()
    return {
        "api_key_configured": bool(api_key),
        "api_key_preview": _mask_secret(api_key),
        "default_key_configured": bool(default_key),
        "user_key_configured": bool(user_key),
        "key_source": get_openai_key_source(),
        "debate_mode": get_debate_mode(),
        "model": get_openai_model(),
        "available_models": AVAILABLE_OPENAI_MODELS,
        "key_sources": KEY_SOURCES,
        "debate_modes": DEBATE_MODES,
    }


def update_openai_settings(
    api_key: str | None,
    model: str,
    key_source: str = DEFAULT_OPENAI_KEY_SOURCE,
    debate_mode: str = DEFAULT_DEBATE_MODE,
) -> dict[str, Any]:
    cleaned_model = model.strip()
    if not cleaned_model or not MODEL_ID_PATTERN.match(cleaned_model):
        raise ValueError("Model must be a non-empty OpenAI model id.")
    if key_source not in KEY_SOURCES:
        raise ValueError("API key source must be default or user.")
    if debate_mode not in DEBATE_MODES:
        raise ValueError("Debate mode must be api or demo.")

    existing_values = dict(DOTENV_VALUES)
    dotenv_default_key = (existing_values.get("OPENAI_API_KEY") or "").strip().lstrip("\ufeff")
    current_user_key = _read_env("OPENAI_USER_API_KEY")
    cleaned_key = (api_key or "").strip()

    if cleaned_key:
        existing_values["OPENAI_USER_API_KEY"] = cleaned_key
    elif current_user_key:
        existing_values["OPENAI_USER_API_KEY"] = current_user_key
    else:
        existing_values.setdefault("OPENAI_USER_API_KEY", "")

    existing_values["OPENAI_API_KEY"] = dotenv_default_key
    existing_values["OPENAI_KEY_SOURCE"] = key_source
    existing_values["OPENAI_DEBATE_MODE"] = debate_mode
    existing_values["OPENAI_MODEL"] = cleaned_model
    existing_values["DATABASE_PATH"] = existing_values.get("DATABASE_PATH") or DATABASE_PATH or "data/app.db"

    _write_env_file(existing_values)
    _set_runtime_env(existing_values)
    _reload_dotenv_values()
    return read_openai_settings()


def _mask_secret(value: str | None) -> str:
    if not value:
        return ""
    if len(value) <= 12:
        return f"{value[:4]}..."
    return f"{value[:7]}...{value[-4:]}"


def _write_env_file(values: dict[str, Any]) -> None:
    ordered_keys = [
        "OPENAI_API_KEY",
        "OPENAI_USER_API_KEY",
        "OPENAI_KEY_SOURCE",
        "OPENAI_DEBATE_MODE",
        "OPENAI_MODEL",
        "DATABASE_PATH",
    ]
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


def _set_runtime_env(values: dict[str, Any]) -> None:
    for key in ["OPENAI_USER_API_KEY", "OPENAI_KEY_SOURCE", "OPENAI_DEBATE_MODE", "OPENAI_MODEL"]:
        value = values.get(key)
        if value:
            os.environ[key] = str(value)
        else:
            os.environ.pop(key, None)
