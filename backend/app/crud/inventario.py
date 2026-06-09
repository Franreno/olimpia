import uuid
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.crud.audit import record_audit
from app.models.inventario import AuditLog, CategoriaEmpresa, Empresa
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
        query = query.filter(Empresa.nome_fantasia.ilike(f"%{q}%"))
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


def update_empresa(db: Session, empresa: Empresa, data: EmpresaUpdate, usuario_id: uuid.UUID) -> Empresa:
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    for field, new_value in updates.items():
        old_value = getattr(empresa, field)
        if old_value != new_value:
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
    return empresa


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
    return (
        db.query(AuditLog)
        .filter(AuditLog.tabela == "empresa", AuditLog.registro_id == empresa_id)
        .order_by(AuditLog.criado_em)
        .all()
    )
