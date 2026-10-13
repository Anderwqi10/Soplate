import pytest


@pytest.fixture
def built_frontend(tmp_path, settings):
    (tmp_path / "index.html").write_text('<div id="root"></div>', encoding="utf-8")
    settings.FRONTEND_DIST = tmp_path
    return tmp_path


def test_spa_route_returns_index(client, built_frontend):
    response = client.get("/loans/7")
    assert response.status_code == 200
    assert 'id="root"' in response.content.decode()
    assert response["Cache-Control"] == "no-cache"


def test_api_404_stays_json(client, built_frontend):
    response = client.get("/api/no-existe/")
    assert response.status_code == 404
    assert "json" in response["Content-Type"]


def test_missing_build_explains_what_to_do(client, tmp_path, settings):
    settings.FRONTEND_DIST = tmp_path
    response = client.get("/")
    assert response.status_code == 503
    assert response.content.decode() == "Falta compilar la app: ejecuta scripts\publicar.ps1"
