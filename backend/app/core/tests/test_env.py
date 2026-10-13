from datetime import timedelta

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from app.env import env_list, secret_key


def test_env_list_splits_and_trims(monkeypatch):
    monkeypatch.setenv("X", " a.ts.net, ,127.0.0.1 ")
    assert env_list("X") == ["a.ts.net", "127.0.0.1"]


def test_secret_key_required_outside_debug():
    with pytest.raises(ImproperlyConfigured, match="DJANGO_SECRET_KEY"):
        secret_key(debug=False, value=None)


def test_secret_key_dev_fallback():
    assert secret_key(debug=True, value="") == "django-insecure-solo-desarrollo"
    assert secret_key(debug=False, value="abc") == "abc"


def test_refresh_token_lasts_30_days():
    assert settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] == timedelta(days=30)
