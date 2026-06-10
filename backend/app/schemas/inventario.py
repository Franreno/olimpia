import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class CategoriaEmpresaOut(BaseModel):
    id: int
    slug: str
    nome: str

    model_config = {"from_attributes": True}


class EmpresaCreate(BaseModel):
    categoria_id: int
    nome_fantasia: str
    razao_social: str | None = None
    cnpj: str | None = None
    endereco: str | None = None
    bairro: str | None = None
    telefone: str | None = None
    email: str | None = None
    aceita_pesquisas: bool = True
    contato_pesquisas: str | None = None
    telefone_pesquisas: str | None = None
    email_pesquisas: str | None = None
    proprietario: str | None = None
    campos_extras: dict | None = None


class EmpresaUpdate(BaseModel):
    nome_fantasia: str | None = None
    razao_social: str | None = None
    cnpj: str | None = None
    endereco: str | None = None
    bairro: str | None = None
    telefone: str | None = None
    email: str | None = None
    aceita_pesquisas: bool | None = None
    contato_pesquisas: str | None = None
    telefone_pesquisas: str | None = None
    email_pesquisas: str | None = None
    proprietario: str | None = None
    campos_extras: dict | None = None


class EmpresaOut(BaseModel):
    id: uuid.UUID
    categoria_id: int
    nome_fantasia: str
    razao_social: str | None
    cnpj: str | None
    endereco: str | None
    bairro: str | None
    telefone: str | None
    email: str | None
    status: str
    data_baixa: date | None
    aceita_pesquisas: bool
    contato_pesquisas: str | None
    telefone_pesquisas: str | None
    email_pesquisas: str | None
    proprietario: str | None
    campos_extras: dict | None
    criado_em: datetime
    atualizado_em: datetime | None

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: int
    tabela: str
    registro_id: uuid.UUID
    usuario_id: uuid.UUID | None
    usuario_nome: str | None = None
    operacao: str
    campo_alterado: str | None
    valor_anterior: Any
    valor_novo: Any
    criado_em: datetime

    model_config = {"from_attributes": True}
