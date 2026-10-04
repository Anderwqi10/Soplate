import pytest
from rest_framework.test import APIClient


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user("ana", password="clave-segura-1")


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user("beto", password="clave-segura-2")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def other_api(other_user):
    client = APIClient()
    client.force_authenticate(other_user)
    return client
