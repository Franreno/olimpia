from datetime import timedelta

import pytest
from jose import jwt

from app.core.config import Settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db")
    monkeypatch.setenv("TEST_DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db_test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key")
    return Settings(_env_file=None)


def test_hash_password_produces_a_different_string_than_input():
    hashed = hash_password("correct horse battery staple")

    assert hashed != "correct horse battery staple"
    assert hashed.startswith("$2b$")


def test_verify_password_accepts_correct_and_rejects_incorrect():
    hashed = hash_password("correct horse battery staple")

    assert verify_password("correct horse battery staple", hashed) is True
    assert verify_password("wrong password", hashed) is False


def test_create_access_token_contains_subject_and_type(settings):
    token = create_access_token(subject="user-123", settings=settings)

    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert "exp" in payload


def test_create_refresh_token_contains_subject_and_type(settings):
    token = create_refresh_token(subject="user-123", settings=settings)

    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == "user-123"
    assert payload["type"] == "refresh"
    assert "exp" in payload


def test_decode_token_returns_payload_for_valid_token(settings):
    token = create_access_token(subject="user-123", settings=settings)

    payload = decode_token(token, settings=settings)

    assert payload is not None
    assert payload["sub"] == "user-123"


def test_decode_token_returns_none_for_invalid_token(settings):
    assert decode_token("not-a-real-token", settings=settings) is None


def test_decode_token_returns_none_for_expired_token(settings):
    token = create_access_token(subject="user-123", settings=settings, expires_delta=timedelta(seconds=-1))

    assert decode_token(token, settings=settings) is None


def test_decode_token_returns_none_when_signed_with_different_secret(settings):
    other_settings = Settings(
        database_url=settings.database_url,
        test_database_url=settings.test_database_url,
        redis_url=settings.redis_url,
        jwt_secret_key="a-completely-different-secret",
        _env_file=None,
    )
    token = create_access_token(subject="user-123", settings=other_settings)

    assert decode_token(token, settings=settings) is None
