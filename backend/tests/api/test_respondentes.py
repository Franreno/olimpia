import re
from datetime import date

import pytest

from app.core.security import hash_password
from app.models.inventario import CategoriaEmpresa, Empresa
from app.models.usuario import Usuario

WEEKDAY_INICIO = "2026-03-02"
WEEKDAY_FIM = "2026-03-06"


# ── fixtures / helpers ──────────────────────────────────────────────────────────


@pytest.fixture
def categoria_mh(db_session):
    cat = CategoriaEmpresa(slug="meios_hospedagem", nome="Meios de Hospedagem")
    db_session.add(cat)
    db_session.commit()
    return cat


@pytest.fixture
def hoteis(db_session, categoria_mh):
    a = Empresa(
        categoria_id=categoria_mh.id, nome_fantasia="Hotel A", status="ativo",
        aceita_pesquisas=True, contato_pesquisas="João", campos_extras={"leitos": 100},
    )
    b = Empresa(
        categoria_id=categoria_mh.id, nome_fantasia="Hotel B", status="ativo",
        aceita_pesquisas=True, campos_extras={"leitos": 300},
    )
    db_session.add_all([a, b])
    db_session.commit()
    return a, b


def _make_usuario(db_session, email, perfil, password="senha-segura-123"):
    u = Usuario(nome="Teste", email=email, senha_hash=hash_password(password), perfil=perfil)
    db_session.add(u)
    db_session.commit()
    return u


def _login(client, email, password="senha-segura-123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _editor(client, db_session, email="ed@example.com"):
    _make_usuario(db_session, email, "editor")
    return _login(client, email)


# ── sincronizar (US 1.7) ──────────────────────────────────────────────────────────


class TestSincronizar:
    def test_enrolls_active_lodging(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        r = client.post("/api/v1/respondentes/sincronizar", headers=_auth(token))
        assert r.status_code == 200
        assert r.json() == {"criados": 2, "total": 2}

    def test_idempotent(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        client.post("/api/v1/respondentes/sincronizar", headers=_auth(token))
        r2 = client.post("/api/v1/respondentes/sincronizar", headers=_auth(token))
        assert r2.json()["criados"] == 0

    def test_assigns_protocolo_xxx_aa(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        client.post("/api/v1/respondentes/sincronizar", headers=_auth(token))
        matrix = client.get("/api/v1/respondentes", headers=_auth(token)).json()
        protocolos = [r["protocolo"] for r in matrix["respondentes"]]
        yy = f"{date.today().year % 100:02d}"
        assert all(re.fullmatch(rf"\d{{3}}/{yy}", p) for p in protocolos)
        assert set(protocolos) == {f"001/{yy}", f"002/{yy}"}

    def test_gestor_cannot_sincronizar(self, client, db_session, hoteis):
        _make_usuario(db_session, "g@example.com", "gestor")
        token = _login(client, "g@example.com")
        r = client.post("/api/v1/respondentes/sincronizar", headers=_auth(token))
        assert r.status_code == 403


# ── matrix (US 1.7) ────────────────────────────────────────────────────────────────


class TestMatrix:
    def _periodo_with_response(self, client, token, empresa_id):
        pid = client.post(
            "/api/v1/ocupacao/periodos",
            json={"tipo": "consolidado", "descricao": "Março 2026", "data_inicio": WEEKDAY_INICIO, "data_fim": WEEKDAY_FIM},
            headers=_auth(token),
        ).json()["id"]
        client.post(
            f"/api/v1/ocupacao/periodos/{pid}/respostas",
            json={"empresa_id": str(empresa_id), "taxa_ocupacao": 80},
            headers=_auth(token),
        )
        return pid

    def test_lists_active_lodging_rows(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        r = client.get("/api/v1/respondentes", headers=_auth(token))
        assert r.status_code == 200
        nomes = {row["nome_fantasia"] for row in r.json()["respondentes"]}
        assert nomes == {"Hotel A", "Hotel B"}

    def test_participation_reflects_responses(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        a, _ = hoteis
        self._periodo_with_response(client, token, a.id)
        body = client.get("/api/v1/respondentes", headers=_auth(token)).json()
        assert len(body["periodos"]) == 1
        rows = {r["nome_fantasia"]: r for r in body["respondentes"]}
        assert rows["Hotel A"]["participacao"] == [True]
        assert rows["Hotel A"]["taxa_participacao"] == 100.0
        assert rows["Hotel B"]["participacao"] == [False]
        assert rows["Hotel B"]["taxa_participacao"] == 0.0

    def test_contato_from_empresa(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        body = client.get("/api/v1/respondentes", headers=_auth(token)).json()
        rows = {r["nome_fantasia"]: r for r in body["respondentes"]}
        assert rows["Hotel A"]["contato"] == "João"

    def test_gestor_can_read(self, client, db_session, hoteis):
        _make_usuario(db_session, "g2@example.com", "gestor")
        token = _login(client, "g2@example.com")
        r = client.get("/api/v1/respondentes", headers=_auth(token))
        assert r.status_code == 200


# ── observação (US 1.7) ─────────────────────────────────────────────────────────────


class TestUpdate:
    def test_editor_updates_observacao(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        client.post("/api/v1/respondentes/sincronizar", headers=_auth(token))
        matrix = client.get("/api/v1/respondentes", headers=_auth(token)).json()
        rid = matrix["respondentes"][0]["respondente_id"]
        r = client.patch(f"/api/v1/respondentes/{rid}", json={"observacao": "Não atende telefone"}, headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["observacao"] == "Não atende telefone"
