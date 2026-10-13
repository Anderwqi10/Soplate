import os

from django.core.exceptions import ImproperlyConfigured

DEV_SECRET_KEY = "django-insecure-solo-desarrollo"


def env_list(name: str, default: str = "") -> list[str]:
    """Lee una variable separada por comas; quita espacios y vacíos."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def secret_key(debug: bool, value: str | None) -> str:
    if value:
        return value
    if debug:
        return DEV_SECRET_KEY
    raise ImproperlyConfigured("Falta DJANGO_SECRET_KEY en backend/app/.env")
