from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.6")


def get_openai_api_key() -> str | None:
    return os.getenv("OPENAI_API_KEY")
