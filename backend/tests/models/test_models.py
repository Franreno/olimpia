from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.demanda import FormularioVersao, RespostaDemanda
from app.models.inventario import AuditLog, CategoriaEmpresa, Empresa, RespondentePesquisa
from app.models.ocupacao import PeriodoOcupacao, RespostaOcupacao, ResultadoOcupacao
from app.models.usuario import Usuario


def make_usuario(db_session, perfil="admin", email="admin@oto.test"):
    usuario = Usuario(nome="Admin", email=email, senha_hash="hashed", perfil=perfil)
    db_session.add(usuario)
    db_session.flush()
    return usuario


def make_categoria(db_session, slug="meios_hospedagem", nome="Meios de Hospedagem"):
    categoria = CategoriaEmpresa(slug=slug, nome=nome)
    db_session.add(categoria)
    db_session.flush()
    return categoria


class TestUsuario:
    def test_create_usuario_with_valid_perfil(self, db_session):
        usuario = make_usuario(db_session, perfil="editor", email="editor@oto.test")

        assert usuario.id is not None
        assert usuario.ativo is True
        assert usuario.criado_em is not None

    @pytest.mark.parametrize("perfil", ["admin", "editor", "pesquisador", "gestor"])
    def test_accepts_each_documented_perfil(self, db_session, perfil):
        usuario = Usuario(nome="X", email=f"{perfil}@oto.test", senha_hash="h", perfil=perfil)
        db_session.add(usuario)
        db_session.flush()

        assert usuario.perfil == perfil

    def test_rejects_undocumented_perfil(self, db_session):
        usuario = Usuario(nome="Bad", email="bad@oto.test", senha_hash="h", perfil="superuser")
        db_session.add(usuario)

        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_email_must_be_unique(self, db_session):
        make_usuario(db_session, email="dup@oto.test")
        db_session.add(Usuario(nome="Other", email="dup@oto.test", senha_hash="h", perfil="gestor"))

        with pytest.raises(IntegrityError):
            db_session.flush()


class TestCategoriaEmpresa:
    def test_create_categoria(self, db_session):
        categoria = make_categoria(db_session)

        assert categoria.id is not None
        assert categoria.slug == "meios_hospedagem"

    def test_slug_must_be_unique(self, db_session):
        make_categoria(db_session, slug="atrativos", nome="Atrativos")
        db_session.add(CategoriaEmpresa(slug="atrativos", nome="Outro nome"))

        with pytest.raises(IntegrityError):
            db_session.flush()


class TestEmpresa:
    def test_create_empresa_defaults_to_ativo(self, db_session):
        categoria = make_categoria(db_session)
        usuario = make_usuario(db_session)

        empresa = Empresa(
            categoria_id=categoria.id,
            nome_fantasia="Hotel Olímpia",
            criado_por=usuario.id,
            campos_extras={"uhs": 40, "leitos": 120},
        )
        db_session.add(empresa)
        db_session.flush()

        assert empresa.id is not None
        assert empresa.status == "ativo"
        assert empresa.aceita_pesquisas is True
        assert empresa.campos_extras == {"uhs": 40, "leitos": 120}

    def test_soft_delete_sets_status_and_data_baixa_without_deleting_row(self, db_session):
        categoria = make_categoria(db_session)
        empresa = Empresa(categoria_id=categoria.id, nome_fantasia="Pousada Sol")
        db_session.add(empresa)
        db_session.flush()
        empresa_id = empresa.id

        empresa.status = "inativo"
        empresa.data_baixa = date(2026, 6, 1)
        db_session.flush()

        reloaded = db_session.get(Empresa, empresa_id)
        assert reloaded is not None
        assert reloaded.status == "inativo"
        assert reloaded.data_baixa == date(2026, 6, 1)

    def test_empresa_requires_categoria(self, db_session):
        empresa = Empresa(nome_fantasia="Sem categoria")
        db_session.add(empresa)

        with pytest.raises(IntegrityError):
            db_session.flush()


class TestAuditLog:
    def test_create_audit_log_entry(self, db_session):
        usuario = make_usuario(db_session)
        categoria = make_categoria(db_session)
        empresa = Empresa(categoria_id=categoria.id, nome_fantasia="Hotel X")
        db_session.add(empresa)
        db_session.flush()

        entry = AuditLog(
            tabela="empresa",
            registro_id=empresa.id,
            usuario_id=usuario.id,
            operacao="UPDATE",
            campo_alterado="nome_fantasia",
            valor_anterior={"nome_fantasia": "Hotel X"},
            valor_novo={"nome_fantasia": "Hotel Y"},
        )
        db_session.add(entry)
        db_session.flush()

        assert entry.id is not None
        assert entry.criado_em is not None

    def test_rejects_unknown_operacao(self, db_session):
        usuario = make_usuario(db_session)
        categoria = make_categoria(db_session)
        empresa = Empresa(categoria_id=categoria.id, nome_fantasia="Hotel X")
        db_session.add(empresa)
        db_session.flush()

        db_session.add(
            AuditLog(
                tabela="empresa",
                registro_id=empresa.id,
                usuario_id=usuario.id,
                operacao="PATCH",
            )
        )

        with pytest.raises(IntegrityError):
            db_session.flush()


class TestRespondentePesquisa:
    def test_create_respondente_for_demanda(self, db_session):
        categoria = make_categoria(db_session)
        empresa = Empresa(categoria_id=categoria.id, nome_fantasia="Restaurante Z")
        db_session.add(empresa)
        db_session.flush()

        respondente = RespondentePesquisa(
            empresa_id=empresa.id,
            tipo_pesquisa="demanda",
            protocolo="001/26",
        )
        db_session.add(respondente)
        db_session.flush()

        assert respondente.id is not None
        assert respondente.respondeu is False

    def test_rejects_unknown_tipo_pesquisa(self, db_session):
        categoria = make_categoria(db_session)
        empresa = Empresa(categoria_id=categoria.id, nome_fantasia="Restaurante Z")
        db_session.add(empresa)
        db_session.flush()

        db_session.add(
            RespondentePesquisa(empresa_id=empresa.id, tipo_pesquisa="opiniao")
        )

        with pytest.raises(IntegrityError):
            db_session.flush()


class TestModulo2Tables:
    def test_create_formulario_versao_and_resposta_demanda(self, db_session):
        usuario = make_usuario(db_session, perfil="pesquisador", email="pesq@oto.test")
        versao = FormularioVersao(ano=2026, schema_json={"campos": []}, criado_por=usuario.id)
        db_session.add(versao)
        db_session.flush()

        resposta = RespostaDemanda(
            formulario_versao_id=versao.id,
            pesquisador_id=usuario.id,
            parque="thermas",
            coletado_em="2026-06-01 10:00:00",
        )
        db_session.add(resposta)
        db_session.flush()

        assert resposta.id is not None
        assert resposta.sync_status == "sincronizado"
        assert resposta.alerta_coerencia is False

    def test_rejects_unknown_parque(self, db_session):
        usuario = make_usuario(db_session, perfil="pesquisador", email="pesq2@oto.test")
        versao = FormularioVersao(ano=2027, schema_json={"campos": []}, criado_por=usuario.id)
        db_session.add(versao)
        db_session.flush()

        db_session.add(
            RespostaDemanda(
                formulario_versao_id=versao.id,
                pesquisador_id=usuario.id,
                parque="parque_inexistente",
                coletado_em="2026-06-01 10:00:00",
            )
        )

        with pytest.raises(IntegrityError):
            db_session.flush()


class TestModulo3Tables:
    def test_create_periodo_resposta_and_resultado_ocupacao(self, db_session):
        usuario = make_usuario(db_session, perfil="editor", email="ed2@oto.test")
        categoria = make_categoria(db_session)
        empresa = Empresa(categoria_id=categoria.id, nome_fantasia="Hotel Periodo")
        db_session.add(empresa)
        db_session.flush()

        periodo = PeriodoOcupacao(
            tipo="consolidado",
            descricao="Março 2026",
            data_inicio=date(2026, 3, 1),
            data_fim=date(2026, 3, 31),
            criado_por=usuario.id,
        )
        db_session.add(periodo)
        db_session.flush()

        resposta = RespostaOcupacao(
            periodo_id=periodo.id,
            empresa_id=empresa.id,
            taxa_ocupacao=75.5,
            uhs_informadas=10,
            leitos_informados=30,
        )
        db_session.add(resposta)
        db_session.flush()

        resultado = ResultadoOcupacao(periodo_id=periodo.id, taxa_ponderada=75.5)
        db_session.add(resultado)
        db_session.flush()

        assert periodo.status == "aberto"
        assert resposta.id is not None
        assert resultado.id is not None

    def test_resposta_ocupacao_unique_per_periodo_and_empresa(self, db_session):
        usuario = make_usuario(db_session, perfil="editor", email="ed3@oto.test")
        categoria = make_categoria(db_session)
        empresa = Empresa(categoria_id=categoria.id, nome_fantasia="Hotel Duplicado")
        db_session.add(empresa)
        db_session.flush()

        periodo = PeriodoOcupacao(
            tipo="expectativa",
            descricao="Carnaval 2026",
            data_inicio=date(2026, 2, 14),
            data_fim=date(2026, 2, 17),
            criado_por=usuario.id,
        )
        db_session.add(periodo)
        db_session.flush()

        db_session.add(RespostaOcupacao(periodo_id=periodo.id, empresa_id=empresa.id, taxa_ocupacao=50))
        db_session.flush()

        db_session.add(RespostaOcupacao(periodo_id=periodo.id, empresa_id=empresa.id, taxa_ocupacao=60))

        with pytest.raises(IntegrityError):
            db_session.flush()
