from fastapi.testclient import TestClient

from app import settings
from app.main import app


def test_read_openai_settings_masks_api_key(monkeypatch) -> None:
    monkeypatch.setattr(
        settings,
        "DOTENV_VALUES",
        {
            "OPENAI_API_KEY": "sk-default-1234567890",
            "OPENAI_USER_API_KEY": "sk-user-1234567890",
            "OPENAI_KEY_SOURCE": "user",
            "OPENAI_DEBATE_MODE": "demo",
            "OPENAI_MODEL": "gpt-test",
        },
    )
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_USER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_KEY_SOURCE", raising=False)
    monkeypatch.delenv("OPENAI_DEBATE_MODE", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)

    status = settings.read_openai_settings()

    assert status["api_key_configured"] is True
    assert status["api_key_preview"] == "sk-user...7890"
    assert status["default_key_configured"] is True
    assert status["user_key_configured"] is True
    assert status["key_source"] == "user"
    assert status["debate_mode"] == "demo"
    assert status["model"] == "gpt-test"
    assert status["available_models"]


def test_env_path_points_to_project_root() -> None:
    assert settings.ENV_PATH == settings.ROOT_DIR / ".env"
    assert (settings.ROOT_DIR / "backend" / "app").is_dir()


def test_read_env_falls_back_to_dotenv_when_os_env_is_blank(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "   ")
    monkeypatch.setattr(settings, "DOTENV_VALUES", {"OPENAI_API_KEY": " sk-proj-test-key "})

    assert settings.get_openai_api_key() == "sk-proj-test-key"


def test_read_env_strips_bom_from_dotenv_value(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    monkeypatch.setattr(settings, "DOTENV_VALUES", {"OPENAI_MODEL": "\ufeffgpt-test-model "})

    assert settings._read_env("OPENAI_MODEL") == "gpt-test-model"


def test_update_openai_settings_writes_env_without_bom(monkeypatch) -> None:
    env_path = settings.ROOT_DIR / "data" / "test_openai_settings.db"
    env_path.parent.mkdir(exist_ok=True)
    env_path.write_text(
        "OPENAI_API_KEY=default-key\nOPENAI_MODEL=old-model\nDATABASE_PATH=data/test.db\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(settings, "ENV_PATH", env_path)
    monkeypatch.setattr(
        settings,
        "DOTENV_VALUES",
        {"OPENAI_API_KEY": "default-key", "OPENAI_MODEL": "old-model", "DATABASE_PATH": "data/test.db"},
    )
    monkeypatch.delenv("OPENAI_USER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_KEY_SOURCE", raising=False)
    monkeypatch.delenv("OPENAI_DEBATE_MODE", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)

    status = settings.update_openai_settings(
        api_key="sk-new-secret",
        model="gpt-5.6-sol",
        key_source="user",
        debate_mode="demo",
    )

    raw = env_path.read_bytes()
    assert raw[:3] != b"\xef\xbb\xbf"
    env_text = env_path.read_text(encoding="utf-8")
    assert "OPENAI_API_KEY=default-key" in env_text
    assert "OPENAI_USER_API_KEY=sk-new-secret" in env_text
    assert "OPENAI_KEY_SOURCE=user" in env_text
    assert "OPENAI_DEBATE_MODE=demo" in env_text
    assert status["api_key_preview"] == "sk-new-...cret"
    assert status["key_source"] == "user"
    assert status["debate_mode"] == "demo"
    assert status["model"] == "gpt-5.6-sol"


def test_openai_settings_endpoint_returns_masked_key(monkeypatch) -> None:
    monkeypatch.setattr(
        settings,
        "read_openai_settings",
        lambda: {
            "api_key_configured": True,
            "api_key_preview": "sk-proj...abcd",
            "default_key_configured": True,
            "user_key_configured": False,
            "key_source": "default",
            "debate_mode": "api",
            "model": "gpt-5.6-luna",
            "available_models": ["gpt-5.6-luna"],
            "key_sources": ["default", "user"],
            "debate_modes": ["api", "demo"],
        },
    )
    client = TestClient(app)

    response = client.get("/api/settings/openai")

    assert response.status_code == 200
    body = response.json()
    assert body["api_key_preview"] == "sk-proj...abcd"
    assert body["key_source"] == "default"
    assert body["debate_mode"] == "api"
    assert "OPENAI_API_KEY" not in body


def test_user_key_source_falls_back_to_default_key(monkeypatch) -> None:
    monkeypatch.setattr(
        settings,
        "DOTENV_VALUES",
        {"OPENAI_API_KEY": "default-key", "OPENAI_KEY_SOURCE": "user"},
    )
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_USER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_KEY_SOURCE", raising=False)

    assert settings.get_openai_api_key() == "default-key"
