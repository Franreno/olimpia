"""Tests for the initial inventory Excel importer (US 1.9)."""

import uuid
from io import BytesIO

import pytest
from openpyxl import Workbook

from app.db.import_inventario import import_workbook
from app.models.inventario import AuditLog, Empresa
from app.models.usuario import Usuario


@pytest.fixture
def categorias(db_session):
    from app.models.inventario import CategoriaEmpresa

    cats = [
        CategoriaEmpresa(slug="meios_hospedagem", nome="Meios de Hospedagem"),
        CategoriaEmpresa(slug="alimentacao", nome="Alimentação"),
        CategoriaEmpresa(slug="atrativos", nome="Atrativos"),
    ]
    db_session.add_all(cats)
    db_session.commit()
    return {c.slug: c for c in cats}


@pytest.fixture
def usuario(db_session):
    from app.core.security import hash_password

    u = Usuario(nome="Admin", email="admin@example.com",
                senha_hash=hash_password("x"), perfil="admin")
    db_session.add(u)
    db_session.commit()
    return u


def _write_xlsx(tmp_path, headers, rows) -> str:
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    dest = tmp_path / "inv.xlsx"
    wb.save(dest)
    return str(dest)


class TestImportWorkbook:
    def test_creates_empresas_with_category_specific_extras(self, db_session, categorias, usuario, tmp_path):
        headers = ["Nome Fantasia", "Categoria", "CNPJ", "Bairro", "UHs", "Leitos", "Tipo"]
        rows = [
            ["Hotel das Águas", "meios_hospedagem", "12.345.678/0001-90", "Centro", 120, 240, "hotel"],
            ["Restaurante Sabor", "Alimentação", None, "Jardim", None, None, None],
        ]
        path = _write_xlsx(tmp_path, headers, rows)

        report = import_workbook(db_session, path, usuario_id=usuario.id)

        assert report.created == 2
        assert report.skipped == 0
        assert report.errors == []

        hotel = db_session.query(Empresa).filter_by(nome_fantasia="Hotel das Águas").one()
        assert hotel.categoria_id == categorias["meios_hospedagem"].id
        assert hotel.cnpj == "12.345.678/0001-90"
        assert hotel.campos_extras == {"uhs": 120, "leitos": 240, "tipo": "hotel"}
        assert hotel.criado_por == usuario.id

    def test_resolves_category_by_display_name_accent_insensitive(self, db_session, categorias, usuario, tmp_path):
        path = _write_xlsx(tmp_path, ["Nome", "Categoria"], [["Parque X", "alimentacao"]])
        report = import_workbook(db_session, path, usuario_id=usuario.id)
        assert report.created == 1
        emp = db_session.query(Empresa).filter_by(nome_fantasia="Parque X").one()
        assert emp.categoria_id == categorias["alimentacao"].id

    def test_writes_audit_insert_per_row(self, db_session, categorias, usuario, tmp_path):
        path = _write_xlsx(tmp_path, ["Nome", "Categoria"], [["Hotel A", "meios_hospedagem"]])
        import_workbook(db_session, path, usuario_id=usuario.id)
        emp = db_session.query(Empresa).filter_by(nome_fantasia="Hotel A").one()
        audits = db_session.query(AuditLog).filter_by(registro_id=emp.id, operacao="INSERT").all()
        assert len(audits) == 1
        assert audits[0].usuario_id == usuario.id
        assert audits[0].valor_novo["origem"] == "import_excel"

    def test_is_idempotent_skips_existing(self, db_session, categorias, usuario, tmp_path):
        path = _write_xlsx(tmp_path, ["Nome", "Categoria"], [["Hotel Dup", "meios_hospedagem"]])
        first = import_workbook(db_session, path, usuario_id=usuario.id)
        assert first.created == 1
        second = import_workbook(db_session, path, usuario_id=usuario.id)
        assert second.created == 0
        assert second.skipped == 1
        assert db_session.query(Empresa).filter_by(nome_fantasia="Hotel Dup").count() == 1

    def test_skips_duplicate_rows_within_same_file(self, db_session, categorias, usuario, tmp_path):
        path = _write_xlsx(
            tmp_path, ["Nome", "Categoria"],
            [["Hotel Twice", "meios_hospedagem"], ["hotel twice", "meios_hospedagem"]],
        )
        report = import_workbook(db_session, path, usuario_id=usuario.id)
        assert report.created == 1
        assert report.skipped == 1

    def test_reports_errors_for_bad_rows_without_aborting(self, db_session, categorias, usuario, tmp_path):
        headers = ["Nome", "Categoria"]
        rows = [
            ["Sem Categoria", None],
            [None, "meios_hospedagem"],
            ["Categoria Errada", "nao_existe"],
            ["Hotel Bom", "meios_hospedagem"],
        ]
        path = _write_xlsx(tmp_path, headers, rows)
        report = import_workbook(db_session, path, usuario_id=usuario.id)

        assert report.created == 1
        assert len(report.errors) == 3
        assert {e.row for e in report.errors} == {2, 3, 4}
        assert db_session.query(Empresa).filter_by(nome_fantasia="Hotel Bom").one()

    def test_dry_run_writes_nothing(self, db_session, categorias, usuario, tmp_path):
        path = _write_xlsx(tmp_path, ["Nome", "Categoria"], [["Hotel Ghost", "meios_hospedagem"]])
        report = import_workbook(db_session, path, usuario_id=usuario.id, dry_run=True)
        assert report.created == 1
        assert db_session.query(Empresa).filter_by(nome_fantasia="Hotel Ghost").count() == 0

    def test_parses_numbers_and_booleans_leniently(self, db_session, categorias, usuario, tmp_path):
        headers = ["Nome", "Categoria", "Leitos", "Aceita Pesquisas"]
        rows = [["Hotel Lenient", "meios_hospedagem", "1.250", "Não"]]
        path = _write_xlsx(tmp_path, headers, rows)
        import_workbook(db_session, path, usuario_id=usuario.id)
        emp = db_session.query(Empresa).filter_by(nome_fantasia="Hotel Lenient").one()
        assert emp.campos_extras["leitos"] == 1250
        assert emp.aceita_pesquisas is False
