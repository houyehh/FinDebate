from app import settings


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
