import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

STATUS_EMPRESA = ("ativo", "inativo")
OPERACOES_AUDIT = ("INSERT", "UPDATE", "DELETE")
TIPOS_PESQUISA = ("taxa_ocupacao", "demanda")


class CategoriaEmpresa(Base):
    __tablename__ = "categoria_empresa"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(80), nullable=False)


class Empresa(Base):
    __tablename__ = "empresa"
    __table_args__ = (CheckConstraint(f"status IN {STATUS_EMPRESA}", name="ck_empresa_status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categoria_empresa.id"), nullable=False)
    nome_fantasia: Mapped[str] = mapped_column(String(120), nullable=False)
    razao_social: Mapped[str | None] = mapped_column(String(120))
    cnpj: Mapped[str | None] = mapped_column(String(18))
    endereco: Mapped[str | None] = mapped_column(String(200))
    bairro: Mapped[str | None] = mapped_column(String(80))
    telefone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(10), default="ativo", server_default="ativo")
    data_baixa: Mapped[date | None] = mapped_column(Date)
    aceita_pesquisas: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    contato_pesquisas: Mapped[str | None] = mapped_column(String(120))
    telefone_pesquisas: Mapped[str | None] = mapped_column(String(20))
    email_pesquisas: Mapped[str | None] = mapped_column(String(120))
    proprietario: Mapped[str | None] = mapped_column(String(200))
    campos_extras: Mapped[dict | None] = mapped_column(JSONB)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    atualizado_em: Mapped[datetime | None] = mapped_column(DateTime)
    criado_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"))


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (CheckConstraint(f"operacao IN {OPERACOES_AUDIT}", name="ck_audit_log_operacao"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tabela: Mapped[str] = mapped_column(String(60), nullable=False)
    registro_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    operacao: Mapped[str] = mapped_column(String(10), nullable=False)
    campo_alterado: Mapped[str | None] = mapped_column(String(80))
    valor_anterior: Mapped[dict | None] = mapped_column(JSONB)
    valor_novo: Mapped[dict | None] = mapped_column(JSONB)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RespondentePesquisa(Base):
    __tablename__ = "respondente_pesquisa"
    __table_args__ = (CheckConstraint(f"tipo_pesquisa IN {TIPOS_PESQUISA}", name="ck_respondente_tipo_pesquisa"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("empresa.id"), nullable=False)
    periodo_id: Mapped[int | None] = mapped_column(ForeignKey("periodo_ocupacao.id"))
    tipo_pesquisa: Mapped[str] = mapped_column(String(30), nullable=False)
    protocolo: Mapped[str | None] = mapped_column(String(10))
    respondeu: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    data_resposta: Mapped[datetime | None] = mapped_column(DateTime)
    observacao: Mapped[str | None] = mapped_column(Text)
