import pytest

from app.core.security import hash_password
from app.models.inventario import CategoriaEmpresa
from app.models.usuario import Usuario


# ── fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def categoria(db_session):
    cat = CategoriaEmpresa(slug="meios_hospedagem", nome="Meios de Hospedagem")
    db_session.add(cat)
    db_session.commit()
    return cat


def _make_usuario(db_session, email, perfil, password="senha-segura-123"):
    u = Usuario(nome="Teste", email=email, senha_hash=hash_password(password), perfil=perfil)
    db_session.add(u)
    db_session.commit()
    return u


def _login(client, email, password="senha-segura-123"):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── POST /api/v1/empresas ────────────────────────────────────────────────────

class TestCreateEmpresa:
    def _payload(self, categoria_id):
        return {
            "categoria_id": categoria_id,
            "nome_fantasia": "Hotel Olímpia",
            "razao_social": "Hotel Olímpia Ltda",
            "cnpj": "12.345.678/0001-90",
            "campos_extras": {"uhs": 40, "leitos": 80, "tipo": "hotel"},
        }

    def test_editor_can_create_empresa(self, client, db_session, categoria):
        _make_usuario(db_session, "editor@example.com", "editor")
        token = _login(client, "editor@example.com")

        r = client.post("/api/v1/empresas", json=self._payload(categoria.id), headers=_auth(token))

        assert r.status_code == 201
        body = r.json()
        assert body["nome_fantasia"] == "Hotel Olímpia"
        assert body["status"] == "ativo"

    def test_create_empresa_writes_insert_audit_log(self, client, db_session, categoria):
        _make_usuario(db_session, "editor2@example.com", "editor")
        token = _login(client, "editor2@example.com")

        client.post("/api/v1/empresas", json=self._payload(categoria.id), headers=_auth(token))

        from app.models.inventario import AuditLog
        log = db_session.query(AuditLog).filter_by(tabela="empresa", operacao="INSERT").first()
        assert log is not None
        assert log.valor_novo is not None

    def test_pesquisador_cannot_create_empresa(self, client, db_session, categoria):
        _make_usuario(db_session, "pesq@example.com", "pesquisador")
        token = _login(client, "pesq@example.com")

        r = client.post("/api/v1/empresas", json=self._payload(categoria.id), headers=_auth(token))

        assert r.status_code == 403

    def test_gestor_cannot_create_empresa(self, client, db_session, categoria):
        _make_usuario(db_session, "gestor@example.com", "gestor")
        token = _login(client, "gestor@example.com")

        r = client.post("/api/v1/empresas", json=self._payload(categoria.id), headers=_auth(token))

        assert r.status_code == 403

    def test_unauthenticated_cannot_create_empresa(self, client, categoria):
        r = client.post("/api/v1/empresas", json=self._payload(categoria.id))

        assert r.status_code == 401


# ── GET /api/v1/empresas ─────────────────────────────────────────────────────

class TestListEmpresas:
    def test_any_authenticated_role_can_list(self, client, db_session):
        _make_usuario(db_session, "gestor2@example.com", "gestor")
        token = _login(client, "gestor2@example.com")

        r = client.get("/api/v1/empresas", headers=_auth(token))

        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_by_status(self, client, db_session, categoria):
        _make_usuario(db_session, "editor3@example.com", "editor")
        token = _login(client, "editor3@example.com")
        client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Ativo A", "campos_extras": {}},
            headers=_auth(token),
        )

        r = client.get("/api/v1/empresas?status=ativo", headers=_auth(token))
        assert r.status_code == 200
        assert all(e["status"] == "ativo" for e in r.json())

    def test_filter_by_nome(self, client, db_session, categoria):
        _make_usuario(db_session, "editor4@example.com", "editor")
        token = _login(client, "editor4@example.com")
        client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Thermas Park Hotel", "campos_extras": {}},
            headers=_auth(token),
        )

        r = client.get("/api/v1/empresas?q=Thermas", headers=_auth(token))
        assert r.status_code == 200
        assert any("Thermas" in e["nome_fantasia"] for e in r.json())

    def test_unauthenticated_cannot_list(self, client):
        r = client.get("/api/v1/empresas")
        assert r.status_code == 401


# ── GET /api/v1/empresas/{id} ────────────────────────────────────────────────

class TestGetEmpresa:
    def test_get_returns_empresa(self, client, db_session, categoria):
        _make_usuario(db_session, "editor5@example.com", "editor")
        token = _login(client, "editor5@example.com")
        created = client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Restaurante Bom", "campos_extras": {}},
            headers=_auth(token),
        ).json()

        r = client.get(f"/api/v1/empresas/{created['id']}", headers=_auth(token))

        assert r.status_code == 200
        assert r.json()["id"] == created["id"]

    def test_get_nonexistent_returns_404(self, client, db_session):
        _make_usuario(db_session, "editor6@example.com", "editor")
        token = _login(client, "editor6@example.com")

        r = client.get("/api/v1/empresas/00000000-0000-0000-0000-000000000000", headers=_auth(token))

        assert r.status_code == 404


# ── PUT /api/v1/empresas/{id} ────────────────────────────────────────────────

class TestUpdateEmpresa:
    def test_update_changes_field_and_writes_audit_log(self, client, db_session, categoria):
        _make_usuario(db_session, "editor7@example.com", "editor")
        token = _login(client, "editor7@example.com")
        created = client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Nome Velho", "campos_extras": {}},
            headers=_auth(token),
        ).json()

        r = client.put(
            f"/api/v1/empresas/{created['id']}",
            json={"nome_fantasia": "Nome Novo"},
            headers=_auth(token),
        )

        assert r.status_code == 200
        assert r.json()["nome_fantasia"] == "Nome Novo"

        from app.models.inventario import AuditLog
        log = db_session.query(AuditLog).filter_by(
            tabela="empresa", operacao="UPDATE", campo_alterado="nome_fantasia"
        ).first()
        assert log is not None
        assert log.valor_anterior == "Nome Velho"
        assert log.valor_novo == "Nome Novo"

    def test_pesquisador_cannot_update(self, client, db_session, categoria):
        _make_usuario(db_session, "editor8@example.com", "editor")
        _make_usuario(db_session, "pesq2@example.com", "pesquisador")
        editor_token = _login(client, "editor8@example.com")
        pesq_token = _login(client, "pesq2@example.com")

        created = client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Empresa X", "campos_extras": {}},
            headers=_auth(editor_token),
        ).json()

        r = client.put(
            f"/api/v1/empresas/{created['id']}",
            json={"nome_fantasia": "Hackeado"},
            headers=_auth(pesq_token),
        )
        assert r.status_code == 403


# ── DELETE /api/v1/empresas/{id} — soft delete ───────────────────────────────

class TestSoftDeleteEmpresa:
    def test_delete_sets_inativo_and_data_baixa(self, client, db_session, categoria):
        _make_usuario(db_session, "editor9@example.com", "editor")
        token = _login(client, "editor9@example.com")
        created = client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Para Fechar", "campos_extras": {}},
            headers=_auth(token),
        ).json()

        r = client.delete(f"/api/v1/empresas/{created['id']}", headers=_auth(token))

        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "inativo"
        assert body["data_baixa"] is not None

    def test_deleted_empresa_still_retrievable(self, client, db_session, categoria):
        _make_usuario(db_session, "editor10@example.com", "editor")
        token = _login(client, "editor10@example.com")
        created = client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Fechada", "campos_extras": {}},
            headers=_auth(token),
        ).json()
        client.delete(f"/api/v1/empresas/{created['id']}", headers=_auth(token))

        r = client.get(f"/api/v1/empresas/{created['id']}", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["status"] == "inativo"

    def test_delete_writes_audit_log(self, client, db_session, categoria):
        _make_usuario(db_session, "editor11@example.com", "editor")
        token = _login(client, "editor11@example.com")
        created = client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Auditada", "campos_extras": {}},
            headers=_auth(token),
        ).json()

        client.delete(f"/api/v1/empresas/{created['id']}", headers=_auth(token))

        from app.models.inventario import AuditLog
        log = db_session.query(AuditLog).filter_by(
            tabela="empresa", operacao="UPDATE", campo_alterado="status"
        ).first()
        assert log is not None
        assert log.valor_novo == "inativo"


# ── GET /api/v1/empresas/{id}/audit ──────────────────────────────────────────

class TestAuditLog:
    def test_audit_history_returned_for_empresa(self, client, db_session, categoria):
        _make_usuario(db_session, "editor12@example.com", "editor")
        token = _login(client, "editor12@example.com")
        created = client.post(
            "/api/v1/empresas",
            json={"categoria_id": categoria.id, "nome_fantasia": "Auditável", "campos_extras": {}},
            headers=_auth(token),
        ).json()
        client.put(
            f"/api/v1/empresas/{created['id']}",
            json={"nome_fantasia": "Auditável v2"},
            headers=_auth(token),
        )

        r = client.get(f"/api/v1/empresas/{created['id']}/audit", headers=_auth(token))

        assert r.status_code == 200
        logs = r.json()
        assert len(logs) >= 2
        operacoes = {e["operacao"] for e in logs}
        assert "INSERT" in operacoes
        assert "UPDATE" in operacoes


# ── GET /api/v1/categorias ───────────────────────────────────────────────────

class TestCategorias:
    def test_list_categorias_returns_existing_categorias(self, client, db_session, categoria):
        _make_usuario(db_session, "gestor3@example.com", "gestor")
        token = _login(client, "gestor3@example.com")

        r = client.get("/api/v1/categorias", headers=_auth(token))

        assert r.status_code == 200
        slugs = {c["slug"] for c in r.json()}
        assert categoria.slug in slugs
