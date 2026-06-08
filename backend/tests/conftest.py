import redis
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.session import Base, get_db
from app.main import app

# import every model module so Base.metadata is fully populated before create_all
from app.models import demanda, inventario, ocupacao, usuario  # noqa: F401

TEST_REDIS_DB = 15


@pytest.fixture(scope="session")
def db_engine():
    settings = get_settings()
    engine = create_engine(settings.test_database_url, future=True)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, autoflush=False, autocommit=False, future=True)
    session = SessionLocal()

    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, trans):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def redis_client():
    settings = get_settings()
    base_url = settings.redis_url.rsplit("/", 1)[0]
    client = redis.Redis.from_url(f"{base_url}/{TEST_REDIS_DB}", decode_responses=True)
    client.flushdb()
    yield client
    client.flushdb()
    client.close()


@pytest.fixture
def client(db_session, redis_client):
    from app.api.v1 import auth as auth_module

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[auth_module.get_redis] = lambda: redis_client

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
