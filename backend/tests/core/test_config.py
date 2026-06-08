from app.core.config import Settings


def test_settings_loads_required_fields_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db")
    monkeypatch.setenv("TEST_DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db_test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_SECRET_KEY", "super-secret")

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+psycopg2://u:p@localhost:5432/db"
    assert settings.test_database_url == "postgresql+psycopg2://u:p@localhost:5432/db_test"
    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.jwt_secret_key == "super-secret"


def test_settings_has_sane_jwt_defaults(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db")
    monkeypatch.setenv("TEST_DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db_test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_SECRET_KEY", "super-secret")

    settings = Settings(_env_file=None)

    assert settings.jwt_algorithm == "HS256"
    assert settings.access_token_expire_minutes == 15
    assert settings.refresh_token_expire_days == 7
    assert settings.log_level == "INFO"


def test_settings_parses_cors_origins_as_list(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db")
    monkeypatch.setenv("TEST_DATABASE_URL", "postgresql+psycopg2://u:p@localhost:5432/db_test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_SECRET_KEY", "super-secret")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")

    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["http://localhost:3000", "http://localhost:3001"]
