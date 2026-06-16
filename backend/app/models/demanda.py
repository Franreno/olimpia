import uuid
from datetime import datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

STATUS_FORMULARIO = ("ativo", "travado")
SYNC_STATUS = ("pendente", "sincronizado")


class Parque(Base):
    """Pesquisa locations (parks/attractions) — dynamic, managed via the API.

    `resposta_demanda.parque` stores `slug` (immutable); `nome` is editable.
    """

    __tablename__ = "parque"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    ordem: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FormularioVersao(Base):
    __tablename__ = "formulario_versao"
    __table_args__ = (CheckConstraint(f"status IN {STATUS_FORMULARIO}", name="ck_formulario_versao_status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ano: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    schema_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(10), default="ativo", server_default="ativo")
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    criado_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"))


class RespostaDemanda(Base):
    __tablename__ = "resposta_demanda"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    formulario_versao_id: Mapped[int] = mapped_column(ForeignKey("formulario_versao.id"), nullable=False)
    pesquisador_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    # stores Parque.slug; validated against active parks at the API layer (no DB enum)
    parque: Mapped[str] = mapped_column(String(40), nullable=False)
    coletado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    sync_status: Mapped[str] = mapped_column(String(15), default="sincronizado", server_default="sincronizado")
    alerta_coerencia: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    descricao_alerta: Mapped[str | None] = mapped_column(Text)


class DemandaEstadia(Base):
    __tablename__ = "demanda_estadia"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resposta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resposta_demanda.id"), unique=True, nullable=False
    )
    estado_residencia: Mapped[str | None] = mapped_column(String(50))
    cidade_residencia: Mapped[str | None] = mapped_column(String(80))
    data_chegada: Mapped[datetime | None] = mapped_column(DateTime)
    data_partida: Mapped[datetime | None] = mapped_column(DateTime)
    pernoites: Mapped[int | None] = mapped_column(Integer)
    meio_hospedagem: Mapped[str | None] = mapped_column(String(60))
    acompanhantes_tipo: Mapped[str | None] = mapped_column(String(40))


class DemandaViagem(Base):
    __tablename__ = "demanda_viagem"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resposta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resposta_demanda.id"), unique=True, nullable=False
    )
    motivo_viagem: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    transporte_utilizado: Mapped[str | None] = mapped_column(String(60))
    considerou_outro_destino: Mapped[bool | None] = mapped_column(Boolean)
    destinos_concorrentes: Mapped[list[str] | None] = mapped_column(ARRAY(Text))


class DemandaSatisfacao(Base):
    __tablename__ = "demanda_satisfacao"
    __table_args__ = (
        CheckConstraint("nps_recomendacao BETWEEN 0 AND 10", name="ck_demanda_satisfacao_nps"),
        CheckConstraint("nota_destino BETWEEN 0 AND 10", name="ck_demanda_satisfacao_nota_destino"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resposta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resposta_demanda.id"), unique=True, nullable=False
    )
    voltaria: Mapped[bool | None] = mapped_column(Boolean)
    indicaria: Mapped[bool | None] = mapped_column(Boolean)
    nps_recomendacao: Mapped[int | None] = mapped_column(SmallInteger)
    nota_destino: Mapped[int | None] = mapped_column(SmallInteger)


class DemandaPerfilSocioeconomico(Base):
    __tablename__ = "demanda_perfil_socioeconomico"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resposta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resposta_demanda.id"), unique=True, nullable=False
    )
    genero: Mapped[str | None] = mapped_column(String(30))
    faixa_etaria: Mapped[str | None] = mapped_column(String(20))
    renda_familiar: Mapped[str | None] = mapped_column(String(40))
    gasto_medio_diario: Mapped[str | None] = mapped_column(String(40))


class AvaliacaoServico(Base):
    __tablename__ = "avaliacao_servico"
    __table_args__ = (CheckConstraint("nota BETWEEN 1 AND 5", name="ck_avaliacao_servico_nota"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resposta_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("resposta_demanda.id"), nullable=False)
    dimensao: Mapped[str] = mapped_column(String(40), nullable=False)
    nota: Mapped[int | None] = mapped_column(SmallInteger)


class AvaliacaoAtrativo(Base):
    __tablename__ = "avaliacao_atrativo"
    __table_args__ = (CheckConstraint("nota BETWEEN 1 AND 5", name="ck_avaliacao_atrativo_nota"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resposta_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("resposta_demanda.id"), nullable=False)
    nome_atrativo: Mapped[str] = mapped_column(String(120), nullable=False)
    nota: Mapped[int | None] = mapped_column(SmallInteger)
