from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user, require_role
from app.crud import respondente as crud
from app.db.session import get_db
from app.models.usuario import Usuario
from app.schemas.respondente import (
    RespondentesMatrixOut,
    RespondenteUpdate,
    SincronizarOut,
)

router = APIRouter()

TIPOS_PESQUISA = ("taxa_ocupacao", "demanda")


@router.get("/respondentes", response_model=RespondentesMatrixOut)
def list_respondentes(
    tipo_pesquisa: str = Query(default="taxa_ocupacao"),
    ano: int | None = Query(default=None),
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if tipo_pesquisa not in TIPOS_PESQUISA:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tipo_pesquisa inválido.")
    return crud.respondentes_matrix(db, tipo_pesquisa, ano)


@router.post("/respondentes/sincronizar", response_model=SincronizarOut)
def sincronizar_respondentes(
    tipo_pesquisa: str = Query(default="taxa_ocupacao"),
    ano: int | None = Query(default=None),
    _: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    if tipo_pesquisa not in TIPOS_PESQUISA:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tipo_pesquisa inválido.")
    return crud.sincronizar_respondentes(db, tipo_pesquisa, ano)


@router.patch("/respondentes/{respondente_id}")
def patch_respondente(
    respondente_id: int,
    data: RespondenteUpdate,
    _: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    r = crud.update_respondente(db, respondente_id, data.observacao)
    if r is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Respondente não encontrado.")
    return {"id": r.id, "observacao": r.observacao}
