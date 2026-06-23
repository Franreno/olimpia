from datetime import date

import pytest

from app.core.security import hash_password
from app.models.inventario import CategoriaEmpresa, Empresa
from app.models.usuario import Usuario

# 2026-03-02 is a Monday, 2026-03-06 a Friday, 2026-03-07 a Saturday.
WEEKDAY_INICIO = "2026-03-02"
WEEKDAY_FIM = "2026-03-06"
SATURDAY = "2026-03-07"


# ── fixtures / helpers ──────────────────────────────────────────────────────────


@pytest.fixture
def categoria_mh(db_session):
    cat = CategoriaEmpresa(slug="meios_hospedagem", nome="Meios de Hospedagem")
    db_session.add(cat)
    db_session.commit()
    return cat


@pytest.fixture
def hoteis(db_session, categoria_mh):
    """Two active lodging establishments — 100 and 300 beds."""
    a = Empresa(
        categoria_id=categoria_mh.id, nome_fantasia="Hotel A", status="ativo",
        aceita_pesquisas=True, campos_extras={"uhs": 50, "leitos": 100, "tipo": "hotel"},
    )
    b = Empresa(
        categoria_id=categoria_mh.id, nome_fantasia="Hotel B", status="ativo",
        aceita_pesquisas=True, campos_extras={"uhs": 150, "leitos": 300, "tipo": "resort"},
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
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _editor(client, db_session, email="ed@example.com"):
    _make_usuario(db_session, email, "editor")
    return _login(client, email)


def _periodo_payload(**over):
    payload = {
        "tipo": "consolidado",
        "descricao": "Março 2026",
        "data_inicio": WEEKDAY_INICIO,
        "data_fim": WEEKDAY_FIM,
    }
    payload.update(over)
    return payload


# ── Períodos: criação (US 3.1) + protocolo (US 1.8) ───────────────────────────────


class TestCreatePeriodo:
    def test_editor_creates_consolidado_period(self, client, db_session):
        token = _editor(client, db_session)
        r = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token))
        assert r.status_code == 201
        body = r.json()
        assert body["tipo"] == "consolidado"
        assert body["status"] == "aberto"

    def test_period_gets_auto_protocolo(self, client, db_session):
        token = _editor(client, db_session)
        r = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token))
        protocolo = r.json()["protocolo"]
        yy = f"{date.today().year % 100:02d}"
        assert protocolo == f"001/{yy}"

    def test_protocolo_increments(self, client, db_session):
        token = _editor(client, db_session)
        client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token))
        r2 = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(descricao="Abril"), headers=_auth(token))
        yy = f"{date.today().year % 100:02d}"
        assert r2.json()["protocolo"] == f"002/{yy}"

    def test_gestor_cannot_create_period(self, client, db_session):
        _make_usuario(db_session, "g@example.com", "gestor")
        token = _login(client, "g@example.com")
        r = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token))
        assert r.status_code == 403

    def test_unauthenticated_cannot_create(self, client):
        r = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload())
        assert r.status_code == 401


# ── Períodos: feriado de fim de semana (US 3.3 / §8.6) ────────────────────────────


class TestWeekendExpectativa:
    def test_expectativa_on_saturday_is_blocked(self, client, db_session):
        token = _editor(client, db_session)
        r = client.post(
            "/api/v1/ocupacao/periodos",
            json=_periodo_payload(tipo="expectativa", data_inicio=SATURDAY, data_fim=SATURDAY),
            headers=_auth(token),
        )
        assert r.status_code == 400
        assert "sábado" in r.json()["detail"].lower() or "domingo" in r.json()["detail"].lower()

    def test_expectativa_on_weekday_is_allowed(self, client, db_session):
        token = _editor(client, db_session)
        r = client.post(
            "/api/v1/ocupacao/periodos",
            json=_periodo_payload(tipo="expectativa"),
            headers=_auth(token),
        )
        assert r.status_code == 201

    def test_consolidado_on_weekend_is_allowed(self, client, db_session):
        token = _editor(client, db_session)
        r = client.post(
            "/api/v1/ocupacao/periodos",
            json=_periodo_payload(tipo="consolidado", data_inicio=SATURDAY, data_fim=SATURDAY),
            headers=_auth(token),
        )
        assert r.status_code == 201


# ── Roster: herança do inventário (US 3.2) + status (US 3.6) ───────────────────────


class TestRoster:
    def _create_periodo(self, client, token):
        return client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token)).json()["id"]

    def test_period_inherits_active_lodging(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        pid = self._create_periodo(client, token)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/estabelecimentos", headers=_auth(token))
        assert r.status_code == 200
        nomes = {e["nome_fantasia"] for e in r.json()}
        assert nomes == {"Hotel A", "Hotel B"}

    def test_all_pending_before_responses(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        pid = self._create_periodo(client, token)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/estabelecimentos", headers=_auth(token))
        assert all(e["status"] == "pendente" for e in r.json())

    def test_nao_aceita_pesquisas_is_nao_responde(self, client, db_session, categoria_mh):
        empresa = Empresa(
            categoria_id=categoria_mh.id, nome_fantasia="Pousada Fechada", status="ativo",
            aceita_pesquisas=False, campos_extras={"leitos": 20},
        )
        db_session.add(empresa)
        db_session.commit()
        token = _editor(client, db_session)
        pid = self._create_periodo(client, token)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/estabelecimentos", headers=_auth(token))
        row = next(e for e in r.json() if e["nome_fantasia"] == "Pousada Fechada")
        assert row["status"] == "nao_responde"

    def test_inactive_lodging_not_inherited(self, client, db_session, categoria_mh, hoteis):
        inativo = Empresa(
            categoria_id=categoria_mh.id, nome_fantasia="Hotel Inativo", status="inativo",
            aceita_pesquisas=True, campos_extras={"leitos": 50},
        )
        db_session.add(inativo)
        db_session.commit()
        token = _editor(client, db_session)
        pid = self._create_periodo(client, token)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/estabelecimentos", headers=_auth(token))
        nomes = {e["nome_fantasia"] for e in r.json()}
        assert "Hotel Inativo" not in nomes


# ── Taxa ponderada (US 3.4) + receita estimada (US 3.5) ───────────────────────────


class TestWeightedResult:
    def _setup(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        a, b = hoteis
        pid = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token)).json()["id"]
        client.post(
            f"/api/v1/ocupacao/periodos/{pid}/respostas",
            json={"empresa_id": str(a.id), "taxa_ocupacao": 80, "diaria_media": 200},
            headers=_auth(token),
        )
        client.post(
            f"/api/v1/ocupacao/periodos/{pid}/respostas",
            json={"empresa_id": str(b.id), "taxa_ocupacao": 60, "diaria_media": 400},
            headers=_auth(token),
        )
        return token, pid

    def test_weighted_rate_by_beds(self, client, db_session, hoteis):
        # (80*100 + 60*300) / (100+300) = 65.00
        token, pid = self._setup(client, db_session, hoteis)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/resultado", headers=_auth(token))
        assert float(r.json()["taxa_ponderada"]) == 65.0

    def test_weighted_diaria(self, client, db_session, hoteis):
        # (200*100 + 400*300) / 400 = 350.00
        token, pid = self._setup(client, db_session, hoteis)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/resultado", headers=_auth(token))
        assert float(r.json()["diaria_media_ponderada"]) == 350.0

    def test_estimated_revenue(self, client, db_session, hoteis):
        # 400 leitos * 0.65 * 350 * 5 diárias = 455000.00
        token, pid = self._setup(client, db_session, hoteis)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/resultado", headers=_auth(token))
        assert float(r.json()["receita_estimada"]) == 455000.0

    def test_responded_status_after_submit(self, client, db_session, hoteis):
        token, pid = self._setup(client, db_session, hoteis)
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/estabelecimentos", headers=_auth(token))
        assert all(e["status"] == "respondeu" for e in r.json())

    def test_pesquisador_cannot_submit(self, client, db_session, hoteis):
        a, _ = hoteis
        _make_usuario(db_session, "pq@example.com", "pesquisador")
        token_ed = _editor(client, db_session)
        pid = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token_ed)).json()["id"]
        token_pq = _login(client, "pq@example.com")
        r = client.post(
            f"/api/v1/ocupacao/periodos/{pid}/respostas",
            json={"empresa_id": str(a.id), "taxa_ocupacao": 50},
            headers=_auth(token_pq),
        )
        assert r.status_code == 403


# ── Recálculo ao alterar leitos no inventário (US 1.6 / §8.5) ──────────────────────


class TestLeitosRecalc:
    def test_updating_beds_recalculates_open_period(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        a, b = hoteis
        pid = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token)).json()["id"]
        client.post(
            f"/api/v1/ocupacao/periodos/{pid}/respostas",
            json={"empresa_id": str(a.id), "taxa_ocupacao": 80, "diaria_media": 200},
            headers=_auth(token),
        )
        client.post(
            f"/api/v1/ocupacao/periodos/{pid}/respostas",
            json={"empresa_id": str(b.id), "taxa_ocupacao": 60, "diaria_media": 400},
            headers=_auth(token),
        )
        # bump Hotel B beds 300 -> 500 via the inventory endpoint
        client.put(
            f"/api/v1/empresas/{b.id}",
            json={"campos_extras": {"uhs": 150, "leitos": 500, "tipo": "resort"}},
            headers=_auth(token),
        )
        r = client.get(f"/api/v1/ocupacao/periodos/{pid}/resultado", headers=_auth(token))
        body = r.json()
        # (80*100 + 60*500) / (100+500) = 63.33
        assert float(body["taxa_ponderada"]) == 63.33
        assert body["total_leitos_inventario"] == 600


# ── Listagem (US 3.1) ──────────────────────────────────────────────────────────────


class TestListPeriodos:
    def test_list_returns_progress_and_rate(self, client, db_session, hoteis):
        token = _editor(client, db_session)
        a, b = hoteis
        pid = client.post("/api/v1/ocupacao/periodos", json=_periodo_payload(), headers=_auth(token)).json()["id"]
        client.post(
            f"/api/v1/ocupacao/periodos/{pid}/respostas",
            json={"empresa_id": str(a.id), "taxa_ocupacao": 80, "diaria_media": 200},
            headers=_auth(token),
        )
        r = client.get("/api/v1/ocupacao/periodos", headers=_auth(token))
        assert r.status_code == 200
        periodo = r.json()[0]
        assert periodo["total_estabelecimentos"] == 2
        assert periodo["total_respondentes"] == 1
