import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

TIPOS_PERIODO = ("consolidado", "expectativa")
STATUS_PERIODO = ("aberto", "encerrado", "publicado")


class PeriodoOcupacao(Base):
    __tablename__ = "periodo_ocupacao"
    __table_args__ = (
        CheckConstraint(f"tipo IN {TIPOS_PERIODO}", name="ck_periodo_ocupacao_tipo"),
        CheckConstraint(f"status IN {STATUS_PERIODO}", name="ck_periodo_ocupacao_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tipo: Mapped[str] = mapped_column(String(15), nullable=False)
    descricao: Mapped[str] = mapped_column(String(100), nullable=False)
    data_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    data_fim: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(15), default="aberto", server_default="aberto")
    protocolo: Mapped[str | None] = mapped_column(String(10))
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    criado_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"))


class RespostaOcupacao(Base):
    __tablename__ = "resposta_ocupacao"
    __table_args__ = (UniqueConstraint("periodo_id", "empresa_id", name="uq_resposta_ocupacao_periodo_empresa"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    periodo_id: Mapped[int] = mapped_column(ForeignKey("periodo_ocupacao.id"), nullable=False)
    empresa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("empresa.id"), nullable=False)
    taxa_ocupacao: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    uhs_informadas: Mapped[int | None] = mapped_column(Integer)
    leitos_informados: Mapped[int | None] = mapped_column(Integer)
    diaria_media: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    respondido_em: Mapped[datetime | None] = mapped_column(DateTime)
    respondido_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    observacao: Mapped[str | None] = mapped_column(Text)


class ResultadoOcupacao(Base):
    __tablename__ = "resultado_ocupacao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    periodo_id: Mapped[int] = mapped_column(ForeignKey("periodo_ocupacao.id"), unique=True, nullable=False)
    taxa_ponderada: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    total_respondentes: Mapped[int | None] = mapped_column(Integer)
    total_leitos_respondidos: Mapped[int | None] = mapped_column(Integer)
    perc_leitos_respondidos: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    diaria_media_ponderada: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    receita_estimada: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    calculado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
