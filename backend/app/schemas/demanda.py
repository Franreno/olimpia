import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

# ── IBGE cities ────────────────────────────────────────────────────────────────


class CidadeOut(BaseModel):
    nome: str
    uf: str


# ── Formulário versão ───────────────────────────────────────────────────────────


class FormularioVersaoCreate(BaseModel):
    ano: int
    schema_json: dict


class FormularioVersaoOut(BaseModel):
    id: int
    ano: int
    schema_json: dict
    status: str
    criado_em: datetime
    criado_por: uuid.UUID | None
    criado_por_nome: str | None = None
    total_respostas: int = 0

    model_config = {"from_attributes": True}


# ── Resposta de demanda (nested sub-tables) ──────────────────────────────────────


class EstadiaIn(BaseModel):
    estado_residencia: str | None = None
    cidade_residencia: str | None = None
    data_chegada: date | None = None
    data_partida: date | None = None
    pernoites: int | None = None
    meio_hospedagem: str | None = None
    acompanhantes_tipo: str | None = None


class ViagemIn(BaseModel):
    motivo_viagem: list[str] | None = None
    transporte_utilizado: str | None = None
    considerou_outro_destino: bool | None = None
    destinos_concorrentes: list[str] | None = None


class SatisfacaoIn(BaseModel):
    voltaria: bool | None = None
    indicaria: bool | None = None
    nps_recomendacao: int | None = Field(default=None, ge=0, le=10)
    nota_destino: int | None = Field(default=None, ge=0, le=10)


class PerfilIn(BaseModel):
    genero: str | None = None
    faixa_etaria: str | None = None
    renda_familiar: str | None = None
    gasto_medio_diario: str | None = None


class AvaliacaoServicoIn(BaseModel):
    dimensao: str
    nota: int | None = Field(default=None, ge=1, le=5)


class AvaliacaoAtrativoIn(BaseModel):
    nome_atrativo: str
    nota: int | None = Field(default=None, ge=1, le=5)


class RespostaDemandaCreate(BaseModel):
    parque: str
    formulario_versao_id: int | None = None  # resolved to active version when omitted
    coletado_em: datetime | None = None
    estadia: EstadiaIn | None = None
    viagem: ViagemIn | None = None
    satisfacao: SatisfacaoIn | None = None
    perfil: PerfilIn | None = None
    avaliacoes_servico: list[AvaliacaoServicoIn] = Field(default_factory=list)
    avaliacoes_atrativo: list[AvaliacaoAtrativoIn] = Field(default_factory=list)


class RespostaDemandaOut(BaseModel):
    id: uuid.UUID
    formulario_versao_id: int
    pesquisador_id: uuid.UUID
    parque: str
    coletado_em: datetime
    sync_status: str
    alerta_coerencia: bool
    descricao_alerta: str | None

    model_config = {"from_attributes": True}


# ── Indicadores / dashboard ──────────────────────────────────────────────────────


class DistribuicaoItem(BaseModel):
    rotulo: str
    quantidade: int
    pct: float


class SerieNpsItem(BaseModel):
    mes: str  # "Mai/25"
    nps: float
    respostas: int


class IndicadoresOut(BaseModel):
    parque: str | None
    ano: int
    total_respostas: int
    nps: float | None
    nps_label: str | None
    promotores: int
    neutros: int
    detratores: int
    media_pernoites: float | None
    ticket_medio: float | None
    mercados_emissores: list[DistribuicaoItem]
    destinos_concorrentes: list[DistribuicaoItem]
    serie_nps: list[SerieNpsItem]
