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
    assert response.content.decode() == "Falta compilar la app: ejecuta scripts\\publicar.ps1"


def test_missing_asset_is_404_not_index(client, built_frontend):
    response = client.get("/assets/index-viejo.js")
    assert response.status_code == 404
    assert 'id="root"' not in response.content.decode()


def test_manifest_is_served_with_manifest_mime_type(built_frontend, settings):
    from django.http import HttpResponse
    from django.test import RequestFactory
    from whitenoise.middleware import WhiteNoiseMiddleware

    (built_frontend / "manifest.webmanifest").write_text("{}", encoding="utf-8")
    settings.WHITENOISE_ROOT = built_frontend
    # WhiteNoise indexa los archivos al crearse, así que se construye después de ajustar settings.
    middleware = WhiteNoiseMiddleware(lambda request: HttpResponse(status=404))
    response = middleware(RequestFactory().get("/manifest.webmanifest"))
    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/manifest+json")
