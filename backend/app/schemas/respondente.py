import uuid

from pydantic import BaseModel


class RespondentePeriodoCol(BaseModel):
    id: int
    descricao: str
    protocolo: str | None


class RespondenteRow(BaseModel):
    respondente_id: int  # 0 when the establishment is not enrolled yet
    empresa_id: uuid.UUID
    nome_fantasia: str
    contato: str | None
    protocolo: str | None
    observacao: str | None
    participacao: list[bool]  # aligned with `periodos` order
    respondidos: int
    total_periodos: int
    taxa_participacao: float


class RespondentesMatrixOut(BaseModel):
    ano: int
    tipo_pesquisa: str
    periodos: list[RespondentePeriodoCol]
    respondentes: list[RespondenteRow]


class SincronizarOut(BaseModel):
    criados: int
    total: int


class RespondenteUpdate(BaseModel):
    observacao: str | None = None
