from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_local_vite_alternate_port_is_allowed_by_cors() -> None:
    client = TestClient(app)

    response = client.options(
        "/api/settings/openai",
        headers={
            "Origin": "http://127.0.0.1:5184",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5184"
