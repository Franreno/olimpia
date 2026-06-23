import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

# ── Período ───────────────────────────────────────────────────────────────────────


class PeriodoCreate(BaseModel):
    tipo: str = Field(pattern="^(consolidado|expectativa)$")
    descricao: str
    data_inicio: date
    data_fim: date


class PeriodoOut(BaseModel):
    id: int
    tipo: str
    descricao: str
    data_inicio: date
    data_fim: date
    status: str
    protocolo: str | None
    criado_em: datetime
    criado_por: uuid.UUID | None

    # derived / joined fields (filled by CRUD, not columns)
    total_respondentes: int = 0
    total_estabelecimentos: int = 0
    taxa_ponderada: Decimal | None = None
    receita_estimada: Decimal | None = None

    model_config = {"from_attributes": True}


# ── Resultado ponderado ─────────────────────────────────────────────────────────


class ResultadoOut(BaseModel):
    periodo_id: int
    taxa_ponderada: Decimal | None
    total_respondentes: int | None
    total_leitos_respondidos: int | None
    perc_leitos_respondidos: Decimal | None
    diaria_media_ponderada: Decimal | None
    receita_estimada: Decimal | None
    total_leitos_inventario: int = 0
    qtd_diarias: int = 0
    calculado_em: datetime | None = None


# ── Estabelecimento dentro de um período (roster + resposta) ─────────────────────


class EstabelecimentoOcupacaoOut(BaseModel):
    empresa_id: uuid.UUID
    nome_fantasia: str
    uhs: int | None
    leitos: int | None
    peso: float  # % share of the period's total beds
    status: str  # "respondeu" | "pendente" | "nao_responde"
    taxa_ocupacao: Decimal | None
    diaria_media: Decimal | None
    receita_estimada: Decimal | None
    respondido_em: datetime | None
    observacao: str | None


# ── Resposta de ocupação (entrada manual por estabelecimento) ────────────────────


class RespostaOcupacaoCreate(BaseModel):
    empresa_id: uuid.UUID
    taxa_ocupacao: Decimal = Field(ge=0, le=100)
    diaria_media: Decimal | None = Field(default=None, ge=0)
    uhs_informadas: int | None = Field(default=None, ge=0)
    leitos_informados: int | None = Field(default=None, ge=0)
    observacao: str | None = None


class RespostaOcupacaoOut(BaseModel):
    id: int
    periodo_id: int
    empresa_id: uuid.UUID
    taxa_ocupacao: Decimal | None
    uhs_informadas: int | None
    leitos_informados: int | None
    diaria_media: Decimal | None
    respondido_em: datetime | None
    respondido_por: uuid.UUID | None
    observacao: str | None

    model_config = {"from_attributes": True}
