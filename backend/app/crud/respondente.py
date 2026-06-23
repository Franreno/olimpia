from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud.ocupacao import active_hospedagem_empresas
from app.models.inventario import Empresa, RespondentePesquisa
from app.models.ocupacao import PeriodoOcupacao, RespostaOcupacao

TIPOS_PESQUISA = ("taxa_ocupacao", "demanda")


def gerar_protocolo_respondente(db: Session, ano: int | None = None) -> str:
    """Sequential per-year protocol (XXX/AA) for respondent enrollments (US 1.8)."""
    ano = ano or date.today().year
    yy = ano % 100
    sufixo = f"/{yy:02d}"
    n = db.query(RespondentePesquisa).filter(RespondentePesquisa.protocolo.like(f"%{sufixo}")).count()
    return f"{n + 1:03d}{sufixo}"


def _enrollment_query(db: Session, tipo_pesquisa: str):
    """The enrollment rows: one per empresa per survey type (periodo_id IS NULL)."""
    return db.query(RespondentePesquisa).filter(
        RespondentePesquisa.tipo_pesquisa == tipo_pesquisa,
        RespondentePesquisa.periodo_id.is_(None),
    )


def sincronizar_respondentes(db: Session, tipo_pesquisa: str, ano: int | None = None) -> dict:
    """Enroll every active lodging establishment not yet registered for this survey type.

    Idempotent: existing enrollments keep their protocol. (US 1.7)
    """
    empresas = active_hospedagem_empresas(db)
    enrolled = {r.empresa_id for r in _enrollment_query(db, tipo_pesquisa).all()}
    criados = 0
    for e in empresas:
        if e.id in enrolled:
            continue
        db.add(
            RespondentePesquisa(
                empresa_id=e.id,
                tipo_pesquisa=tipo_pesquisa,
                periodo_id=None,
                protocolo=gerar_protocolo_respondente(db, ano),
                respondeu=False,
            )
        )
        db.flush()  # so the next protocol count includes this new row
        criados += 1
    db.commit()
    return {"criados": criados, "total": len(empresas)}


def _year_periodos(db: Session, ano: int) -> list[PeriodoOcupacao]:
    return (
        db.query(PeriodoOcupacao)
        .filter(func.extract("year", PeriodoOcupacao.data_inicio) == ano)
        .order_by(PeriodoOcupacao.data_inicio, PeriodoOcupacao.id)
        .all()
    )


def _contato(empresa: Empresa) -> str | None:
    return empresa.contato_pesquisas or empresa.telefone_pesquisas or empresa.email_pesquisas


def respondentes_matrix(db: Session, tipo_pesquisa: str, ano: int | None = None) -> dict:
    """Participation matrix: active lodging × the year's periods, with enrollment protocol."""
    ano = ano or date.today().year
    periodos = _year_periodos(db, ano)
    periodo_ids = [p.id for p in periodos]

    enrollments = {r.empresa_id: r for r in _enrollment_query(db, tipo_pesquisa).all()}
    empresas = active_hospedagem_empresas(db)

    responded: set[tuple] = set()
    if periodo_ids:
        rows = (
            db.query(RespostaOcupacao.empresa_id, RespostaOcupacao.periodo_id)
            .filter(
                RespostaOcupacao.periodo_id.in_(periodo_ids),
                RespostaOcupacao.taxa_ocupacao.isnot(None),
            )
            .all()
        )
        responded = {(eid, pid) for eid, pid in rows}

    respondentes = []
    total = len(periodo_ids)
    for e in empresas:
        enr = enrollments.get(e.id)
        participacao = [(e.id, pid) in responded for pid in periodo_ids]
        respondidos = sum(participacao)
        respondentes.append(
            {
                "respondente_id": enr.id if enr else 0,
                "empresa_id": e.id,
                "nome_fantasia": e.nome_fantasia,
                "contato": _contato(e),
                "protocolo": enr.protocolo if enr else None,
                "observacao": enr.observacao if enr else None,
                "participacao": participacao,
                "respondidos": respondidos,
                "total_periodos": total,
                "taxa_participacao": round(respondidos / total * 100, 1) if total else 0.0,
            }
        )

    return {
        "ano": ano,
        "tipo_pesquisa": tipo_pesquisa,
        "periodos": [
            {"id": p.id, "descricao": p.descricao, "protocolo": p.protocolo} for p in periodos
        ],
        "respondentes": respondentes,
    }


def update_respondente(db: Session, respondente_id: int, observacao: str | None) -> RespondentePesquisa | None:
    r = db.get(RespondentePesquisa, respondente_id)
    if r is None:
        return None
    r.observacao = observacao
    db.commit()
    db.refresh(r)
    return r
