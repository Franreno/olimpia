from app.core.security import hash_password
from app.models.usuario import Usuario


def make_usuario(db_session, email="user@example.com", password="senha-segura-123", perfil="admin", ativo=True):
    usuario = Usuario(
        nome="Usuário Teste",
        email=email,
        senha_hash=hash_password(password),
        perfil=perfil,
        ativo=ativo,
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


class TestLogin:
    def test_login_with_valid_credentials_returns_access_token_and_sets_refresh_cookie(self, client, db_session):
        make_usuario(db_session, email="login@example.com", password="senha-segura-123")

        response = client.post("/api/v1/auth/login", json={"email": "login@example.com", "password": "senha-segura-123"})

        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert "refresh_token" in response.cookies

    def test_login_with_wrong_password_returns_401(self, client, db_session):
        make_usuario(db_session, email="wrongpw@example.com", password="senha-segura-123")

        response = client.post("/api/v1/auth/login", json={"email": "wrongpw@example.com", "password": "errada"})

        assert response.status_code == 401

    def test_login_with_unknown_email_returns_401(self, client):
        response = client.post("/api/v1/auth/login", json={"email": "nope@example.com", "password": "x"})

        assert response.status_code == 401

    def test_login_with_inactive_user_returns_401(self, client, db_session):
        make_usuario(db_session, email="inactive@example.com", password="senha-segura-123", ativo=False)

        response = client.post("/api/v1/auth/login", json={"email": "inactive@example.com", "password": "senha-segura-123"})

        assert response.status_code == 401

    def test_login_stores_refresh_token_in_redis(self, client, db_session, redis_client):
        usuario = make_usuario(db_session, email="redis@example.com", password="senha-segura-123")

        response = client.post("/api/v1/auth/login", json={"email": "redis@example.com", "password": "senha-segura-123"})

        assert response.status_code == 200
        stored = redis_client.get(f"refresh_token:{usuario.id}")
        assert stored == response.cookies["refresh_token"]


class TestRefresh:
    def test_refresh_with_valid_cookie_returns_new_access_token(self, client, db_session):
        make_usuario(db_session, email="refresh@example.com", password="senha-segura-123")
        login = client.post("/api/v1/auth/login", json={"email": "refresh@example.com", "password": "senha-segura-123"})
        refresh_token = login.cookies["refresh_token"]

        response = client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})

        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_refresh_without_cookie_returns_401(self, client):
        response = client.post("/api/v1/auth/refresh")

        assert response.status_code == 401

    def test_refresh_with_revoked_token_returns_401(self, client, db_session):
        make_usuario(db_session, email="revoked@example.com", password="senha-segura-123")
        login = client.post("/api/v1/auth/login", json={"email": "revoked@example.com", "password": "senha-segura-123"})
        refresh_token = login.cookies["refresh_token"]

        client.post("/api/v1/auth/logout", cookies={"refresh_token": refresh_token})
        response = client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})

        assert response.status_code == 401


class TestLogout:
    def test_logout_clears_redis_entry_and_cookie(self, client, db_session, redis_client):
        usuario = make_usuario(db_session, email="logout@example.com", password="senha-segura-123")
        login = client.post("/api/v1/auth/login", json={"email": "logout@example.com", "password": "senha-segura-123"})
        refresh_token = login.cookies["refresh_token"]

        response = client.post("/api/v1/auth/logout", cookies={"refresh_token": refresh_token})

        assert response.status_code == 200
        assert redis_client.get(f"refresh_token:{usuario.id}") is None


class TestRBAC:
    def _login(self, client, db_session, email, perfil, password="senha-segura-123"):
        make_usuario(db_session, email=email, password=password, perfil=perfil)
        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        return login.json()["access_token"]

    def test_me_endpoint_returns_current_user(self, client, db_session):
        token = self._login(client, db_session, "me@example.com", "gestor")

        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 200
        body = response.json()
        assert body["email"] == "me@example.com"
        assert body["perfil"] == "gestor"

    def test_me_endpoint_without_token_returns_401(self, client):
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 401

    def test_me_endpoint_with_garbage_token_returns_401(self, client):
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"})

        assert response.status_code == 401
