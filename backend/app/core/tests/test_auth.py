import pytest

pytestmark = pytest.mark.django_db


def test_token_login_and_me(client, django_user_model):
    django_user_model.objects.create_user("ana", password="clave-segura-1")
    r = client.post("/api/auth/token/", {"username": "ana", "password": "clave-segura-1"})
    assert r.status_code == 200 and "access" in r.json()
    me = client.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
    assert me.json()["username"] == "ana"


def test_me_requires_auth(client):
    assert client.get("/api/me/").status_code == 401
