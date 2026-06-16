from datetime import date, datetime

import pytest

from app.core.security import hash_password
from app.db.seed import DEMANDA_SCHEMA
from app.models.demanda import FormularioVersao, Parque
from app.models.usuario import Usuario

CURRENT_YEAR = date.today().year


# ── fixtures / helpers ──────────────────────────────────────────────────────────


@pytest.fixture
def parques(db_session):
    rows = [
        Parque(slug="thermas", nome="Thermas dos Laranjais", ordem=1),
        Parque(slug="rubio", nome="Rubio Termas", ordem=2),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return rows


@pytest.fixture
def formulario_ativo(db_session, parques):
    fv = FormularioVersao(ano=CURRENT_YEAR, schema_json=DEMANDA_SCHEMA, status="ativo")
    db_session.add(fv)
    db_session.commit()
    return fv


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


def _resposta_payload(**over):
    payload = {
        "parque": "thermas",
        "coletado_em": datetime(CURRENT_YEAR, 5, 2, 10, 0).isoformat(),
        "estadia": {"estado_residencia": "SP", "cidade_residencia": "Campinas", "pernoites": 3},
        "satisfacao": {"nps_recomendacao": 10, "nota_destino": 9, "voltaria": True, "indicaria": True},
        "perfil": {"renda_familiar": "R$ 4.001 – R$ 8.000", "gasto_medio_diario": "300"},
        "viagem": {"destinos_concorrentes": ["Caldas Novas (GO)"]},
    }
    payload.update(over)
    return payload


# ── cidades (US 2.2) ──────────────────────────────────────────────────────────────


class TestCidadesAutocomplete:
    def test_prefix_search_returns_matches(self, client, db_session):
        _make_usuario(db_session, "p@example.com", "pesquisador")
        token = _login(client, "p@example.com")
        r = client.get("/api/v1/demanda/cidades", params={"q": "olim"}, headers=_auth(token))
        assert r.status_code == 200
        nomes = [c["nome"] for c in r.json()]
        assert any("Olímpia" == n for n in nomes)

    def test_accent_insensitive(self, client, db_session):
        _make_usuario(db_session, "p2@example.com", "pesquisador")
        token = _login(client, "p2@example.com")
        r = client.get("/api/v1/demanda/cidades", params={"q": "sao paulo"}, headers=_auth(token))
        assert r.status_code == 200
        assert any(c["nome"] == "São Paulo" for c in r.json())


# ── parques (dynamic) ─────────────────────────────────────────────────────────────


class TestParques:
    def test_list_parques(self, client, db_session, parques):
        _make_usuario(db_session, "pq@example.com", "gestor")
        token = _login(client, "pq@example.com")
        r = client.get("/api/v1/demanda/parques", headers=_auth(token))
        assert r.status_code == 200
        slugs = [p["slug"] for p in r.json()]
        assert "thermas" in slugs and "rubio" in slugs

    def test_editor_creates_parque_with_generated_slug(self, client, db_session):
        _make_usuario(db_session, "pq2@example.com", "editor")
        token = _login(client, "pq2@example.com")
        r = client.post(
            "/api/v1/demanda/parques",
            json={"nome": "Parque Aquático Olímpia"},
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()["slug"] == "parque_aquatico_olimpia"
        assert r.json()["ativo"] is True

    def test_gestor_cannot_create_parque(self, client, db_session):
        _make_usuario(db_session, "pq3@example.com", "gestor")
        token = _login(client, "pq3@example.com")
        r = client.post("/api/v1/demanda/parques", json={"nome": "Novo"}, headers=_auth(token))
        assert r.status_code == 403

    def test_update_parque_rename_and_deactivate(self, client, db_session, parques):
        _make_usuario(db_session, "pq4@example.com", "admin")
        token = _login(client, "pq4@example.com")
        pid = parques[0].id
        r = client.patch(
            f"/api/v1/demanda/parques/{pid}",
            json={"nome": "Thermas (renomeado)", "ativo": False},
            headers=_auth(token),
        )
        assert r.status_code == 200
        assert r.json()["nome"] == "Thermas (renomeado)"
        assert r.json()["ativo"] is False
        assert r.json()["slug"] == "thermas"  # slug stays immutable

    def test_apenas_ativos_filter(self, client, db_session, parques):
        _make_usuario(db_session, "pq5@example.com", "admin")
        token = _login(client, "pq5@example.com")
        client.patch(
            f"/api/v1/demanda/parques/{parques[1].id}",
            json={"ativo": False},
            headers=_auth(token),
        )
        r = client.get("/api/v1/demanda/parques", params={"apenas_ativos": True}, headers=_auth(token))
        slugs = [p["slug"] for p in r.json()]
        assert "rubio" not in slugs and "thermas" in slugs


# ── formulário versão (US 2.5) ────────────────────────────────────────────────────


class TestFormularioVersao:
    def test_get_active_form(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "g@example.com", "gestor")
        token = _login(client, "g@example.com")
        r = client.get("/api/v1/demanda/formularios/ativo", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["ano"] == CURRENT_YEAR
        assert r.json()["status"] == "ativo"

    def test_create_version_must_be_next_year(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "e@example.com", "editor")
        token = _login(client, "e@example.com")
        # same year as active → rejected
        r = client.post(
            "/api/v1/demanda/formularios",
            json={"ano": CURRENT_YEAR, "schema_json": {"campos": []}},
            headers=_auth(token),
        )
        assert r.status_code == 400

    def test_create_next_year_version(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "e2@example.com", "editor")
        token = _login(client, "e2@example.com")
        r = client.post(
            "/api/v1/demanda/formularios",
            json={"ano": CURRENT_YEAR + 1, "schema_json": {"campos": []}},
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()["ano"] == CURRENT_YEAR + 1

    def test_gestor_cannot_create_version(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "g2@example.com", "gestor")
        token = _login(client, "g2@example.com")
        r = client.post(
            "/api/v1/demanda/formularios",
            json={"ano": CURRENT_YEAR + 1, "schema_json": {"campos": []}},
            headers=_auth(token),
        )
        assert r.status_code == 403

    def test_list_includes_response_counts(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "pe@example.com", "pesquisador")
        token = _login(client, "pe@example.com")
        client.post("/api/v1/demanda/respostas", json=_resposta_payload(), headers=_auth(token))
        r = client.get("/api/v1/demanda/formularios", headers=_auth(token))
        assert r.status_code == 200
        atual = next(f for f in r.json() if f["ano"] == CURRENT_YEAR)
        assert atual["total_respostas"] == 1


# ── respostas (US 2.4 parque obrigatório, 2.3 coerência) ──────────────────────────


class TestRespostas:
    def test_pesquisador_can_submit(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps@example.com", "pesquisador")
        token = _login(client, "ps@example.com")
        r = client.post("/api/v1/demanda/respostas", json=_resposta_payload(), headers=_auth(token))
        assert r.status_code == 201
        assert r.json()["parque"] == "thermas"
        assert r.json()["alerta_coerencia"] is False

    def test_parque_required(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps2@example.com", "pesquisador")
        token = _login(client, "ps2@example.com")
        payload = _resposta_payload()
        del payload["parque"]
        r = client.post("/api/v1/demanda/respostas", json=payload, headers=_auth(token))
        assert r.status_code == 422

    def test_gestor_cannot_submit(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "g3@example.com", "gestor")
        token = _login(client, "g3@example.com")
        r = client.post("/api/v1/demanda/respostas", json=_resposta_payload(), headers=_auth(token))
        assert r.status_code == 403

    def test_coherence_alert_flagged(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps3@example.com", "pesquisador")
        token = _login(client, "ps3@example.com")
        # renda max 2000, fator 0.5 → threshold 1000; gasto 1500 > 1000 → alerta
        payload = _resposta_payload(perfil={"renda_familiar": "Até R$ 2.000", "gasto_medio_diario": "1500"})
        r = client.post("/api/v1/demanda/respostas", json=payload, headers=_auth(token))
        assert r.status_code == 201
        assert r.json()["alerta_coerencia"] is True
        assert r.json()["descricao_alerta"]

    def test_submit_without_active_form_fails(self, client, db_session):
        _make_usuario(db_session, "ps4@example.com", "pesquisador")
        token = _login(client, "ps4@example.com")
        r = client.post("/api/v1/demanda/respostas", json=_resposta_payload(), headers=_auth(token))
        assert r.status_code == 400

    def test_unknown_parque_rejected(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps9@example.com", "pesquisador")
        token = _login(client, "ps9@example.com")
        r = client.post(
            "/api/v1/demanda/respostas",
            json=_resposta_payload(parque="parque_inexistente"),
            headers=_auth(token),
        )
        assert r.status_code == 400


# ── indicadores (US 2.6, 2.7) ─────────────────────────────────────────────────────


class TestIndicadores:
    def test_nps_and_aggregates(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps5@example.com", "pesquisador")
        token = _login(client, "ps5@example.com")
        notas = [10, 9, 9, 5]  # 3 promotores, 1 detrator → NPS 50
        for n in notas:
            payload = _resposta_payload()
            payload["satisfacao"]["nps_recomendacao"] = n
            client.post("/api/v1/demanda/respostas", json=payload, headers=_auth(token))

        r = client.get("/api/v1/demanda/indicadores", params={"parque": "thermas"}, headers=_auth(token))
        assert r.status_code == 200
        body = r.json()
        assert body["total_respostas"] == 4
        assert body["nps"] == 50.0
        assert body["nps_label"] == "Excelente"
        assert body["media_pernoites"] == 3.0
        assert body["ticket_medio"] == 900.0  # gasto 300 * 3 pernoites
        assert any(m["rotulo"] == "SP" for m in body["mercados_emissores"])
        assert any(d["rotulo"] == "Caldas Novas (GO)" for d in body["destinos_concorrentes"])
        assert len(body["serie_nps"]) == 12

    def test_indicadores_filtered_by_parque(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps6@example.com", "pesquisador")
        token = _login(client, "ps6@example.com")
        client.post("/api/v1/demanda/respostas", json=_resposta_payload(parque="thermas"), headers=_auth(token))
        client.post("/api/v1/demanda/respostas", json=_resposta_payload(parque="rubio"), headers=_auth(token))
        r = client.get("/api/v1/demanda/indicadores", params={"parque": "rubio"}, headers=_auth(token))
        assert r.json()["total_respostas"] == 1


# ── export (US 2.9) ───────────────────────────────────────────────────────────────


class TestExport:
    def test_xlsx_export(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps7@example.com", "pesquisador")
        token = _login(client, "ps7@example.com")
        client.post("/api/v1/demanda/respostas", json=_resposta_payload(), headers=_auth(token))
        r = client.get("/api/v1/demanda/export", params={"formato": "xlsx"}, headers=_auth(token))
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers["content-type"]
        assert r.content[:2] == b"PK"  # xlsx is a zip

    def test_csv_export(self, client, db_session, formulario_ativo):
        _make_usuario(db_session, "ps8@example.com", "pesquisador")
        token = _login(client, "ps8@example.com")
        client.post("/api/v1/demanda/respostas", json=_resposta_payload(), headers=_auth(token))
        r = client.get("/api/v1/demanda/export", params={"formato": "csv"}, headers=_auth(token))
        assert r.status_code == 200
        assert "csv" in r.headers["content-type"]
        assert b"nps_recomendacao" in r.content
