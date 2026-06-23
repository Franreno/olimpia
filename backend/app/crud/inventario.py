import uuid
from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud.audit import record_audit
from app.models.inventario import AuditLog, CategoriaEmpresa, Empresa
from app.models.usuario import Usuario
from app.schemas.inventario import EmpresaCreate, EmpresaUpdate


def list_categorias(db: Session) -> list[CategoriaEmpresa]:
    return db.query(CategoriaEmpresa).order_by(CategoriaEmpresa.nome).all()


def list_empresas(
    db: Session,
    categoria_id: int | None = None,
    status: str | None = None,
    q: str | None = None,
) -> list[Empresa]:
    query = db.query(Empresa)
    if categoria_id is not None:
        query = query.filter(Empresa.categoria_id == categoria_id)
    if status is not None:
        query = query.filter(Empresa.status == status)
    if q:
        # Accent-insensitive: "turismo" matches "Turísmo" and vice-versa.
        query = query.filter(
            func.unaccent(Empresa.nome_fantasia).ilike(func.unaccent(f"%{q}%"))
        )
    return query.order_by(Empresa.nome_fantasia).all()


def get_empresa(db: Session, empresa_id: uuid.UUID) -> Empresa | None:
    return db.get(Empresa, empresa_id)


def create_empresa(db: Session, data: EmpresaCreate, usuario_id: uuid.UUID) -> Empresa:
    empresa = Empresa(**data.model_dump(), criado_por=usuario_id)
    db.add(empresa)
    db.flush()  # populate empresa.id before audit

    snapshot = {k: str(v) if not isinstance(v, (str, int, float, bool, dict, list, type(None))) else v
                for k, v in data.model_dump().items()}
    record_audit(db, "empresa", empresa.id, usuario_id, "INSERT", valor_novo=snapshot)
    db.commit()
    db.refresh(empresa)
    return empresa


def _normalize_for_diff(value):
    """Treat None, "", {} and [] as equivalent "empty" values for audit diffing."""
    if value in ("", {}, []):
        return None
    return value


def update_empresa(db: Session, empresa: Empresa, data: EmpresaUpdate, usuario_id: uuid.UUID) -> Empresa:
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    for field, new_value in updates.items():
        old_value = getattr(empresa, field)

        if field == "campos_extras":
            old_extras = old_value or {}
            new_extras = new_value or {}
            changed = False
            for key in set(old_extras) | set(new_extras):
                old_v = old_extras.get(key)
                new_v = new_extras.get(key)
                if _normalize_for_diff(old_v) == _normalize_for_diff(new_v):
                    continue
                changed = True
                record_audit(
                    db, "empresa", empresa.id, usuario_id, "UPDATE",
                    campo_alterado=key,
                    valor_anterior=old_v,
                    valor_novo=new_v,
                )
            if changed:
                setattr(empresa, field, new_value)
            continue

        if _normalize_for_diff(old_value) == _normalize_for_diff(new_value):
            continue
        record_audit(
            db, "empresa", empresa.id, usuario_id, "UPDATE",
            campo_alterado=field,
            valor_anterior=old_value,
            valor_novo=new_value,
        )
        setattr(empresa, field, new_value)

    empresa.atualizado_em = datetime.utcnow()
    db.commit()
    db.refresh(empresa)

    # US 1.6 / §8.5 — changing the bed count of a lodging establishment re-derives the
    # weighted occupancy of every open period (synchronous, no Celery).
    if "campos_extras" in updates:
        _recalc_open_periods_if_hospedagem(db, empresa)

    return empresa


def _recalc_open_periods_if_hospedagem(db: Session, empresa: Empresa) -> None:
    categoria = db.get(CategoriaEmpresa, empresa.categoria_id)
    if categoria is not None and categoria.slug == "meios_hospedagem":
        # imported lazily to avoid a circular import (ocupacao crud imports inventario models)
        from app.crud.ocupacao import recalcular_periodos_abertos

        recalcular_periodos_abertos(db)


def soft_delete_empresa(db: Session, empresa: Empresa, usuario_id: uuid.UUID) -> Empresa:
    record_audit(db, "empresa", empresa.id, usuario_id, "UPDATE",
                 campo_alterado="status", valor_anterior=empresa.status, valor_novo="inativo")
    record_audit(db, "empresa", empresa.id, usuario_id, "UPDATE",
                 campo_alterado="data_baixa", valor_anterior=None, valor_novo=str(date.today()))

    empresa.status = "inativo"
    empresa.data_baixa = date.today()
    empresa.atualizado_em = datetime.utcnow()
    db.commit()
    db.refresh(empresa)
    return empresa


def get_audit_log(db: Session, empresa_id: uuid.UUID) -> list[AuditLog]:
    rows = (
        db.query(AuditLog, Usuario.nome)
        .outerjoin(Usuario, AuditLog.usuario_id == Usuario.id)
        .filter(AuditLog.tabela == "empresa", AuditLog.registro_id == empresa_id)
        .order_by(AuditLog.criado_em.desc(), AuditLog.id.desc())
        .all()
    )
    logs = []
    for log, usuario_nome in rows:
        log.usuario_nome = usuario_nome
        logs.append(log)
    return logs
