import uuid

from sqlalchemy.orm import Session

from app.models.inventario import AuditLog


def record_audit(
    db: Session,
    tabela: str,
    registro_id: uuid.UUID,
    usuario_id: uuid.UUID | None,
    operacao: str,
    campo_alterado: str | None = None,
    valor_anterior=None,
    valor_novo=None,
) -> AuditLog:
    log = AuditLog(
        tabela=tabela,
        registro_id=registro_id,
        usuario_id=usuario_id,
        operacao=operacao,
        campo_alterado=campo_alterado,
        valor_anterior=valor_anterior,
        valor_novo=valor_novo,
    )
    db.add(log)
    # caller must commit; audit is written in the same transaction as the change
    return log
