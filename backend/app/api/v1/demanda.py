from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.ibge import search_cidades
from app.core.rbac import get_current_user, require_role
from app.crud import demanda as crud
from app.db.session import get_db
from app.models.usuario import Usuario
from app.schemas.demanda import (
    CidadeOut,
    FormularioVersaoCreate,
    FormularioVersaoOut,
    IndicadoresOut,
    ParqueCreate,
    ParqueOut,
    ParqueUpdate,
    RespostaDemandaCreate,
    RespostaDemandaOut,
)

router = APIRouter()


# ── Parques (dynamic survey locations) ────────────────────────────────────────────


@router.get("/parques", response_model=list[ParqueOut])
def list_parques(
    apenas_ativos: bool = Query(default=False),
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.list_parques(db, apenas_ativos=apenas_ativos)


@router.post("/parques", response_model=ParqueOut, status_code=status.HTTP_201_CREATED)
def create_parque(
    data: ParqueCreate,
    _: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    return crud.create_parque(db, data)


@router.patch("/parques/{parque_id}", response_model=ParqueOut)
def update_parque(
    parque_id: int,
    data: ParqueUpdate,
    _: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    parque = crud.get_parque(db, parque_id)
    if parque is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parque não encontrado.")
    return crud.update_parque(db, parque, data)


# ── Cidades (autocomplete IBGE) ──────────────────────────────────────────────────


@router.get("/cidades", response_model=list[CidadeOut])
def autocomplete_cidades(
    q: str = Query(min_length=2),
    limit: int = Query(default=8, ge=1, le=20),
    _: Usuario = Depends(get_current_user),
):
    return search_cidades(q, limit=limit)


# ── Formulário versão ───────────────────────────────────────────────────────────


@router.get("/formularios", response_model=list[FormularioVersaoOut])
def list_formularios(_: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return crud.list_formularios(db)


@router.get("/formularios/ativo", response_model=FormularioVersaoOut)
def get_formulario_ativo(
    ano: int | None = Query(default=None),
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fv = crud.get_active_formulario(db, ano)
    if fv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhum formulário ativo encontrado.")
    return fv


@router.get("/formularios/{ano}", response_model=FormularioVersaoOut)
def get_formulario(ano: int, _: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    fv = crud.get_formulario_by_ano(db, ano)
    if fv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formulário não encontrado.")
    return fv


@router.post("/formularios", response_model=FormularioVersaoOut, status_code=status.HTTP_201_CREATED)
def create_formulario(
    data: FormularioVersaoCreate,
    usuario: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_formulario(db, data, usuario.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/formularios/{ano}/travar", response_model=FormularioVersaoOut)
def lock_formulario(
    ano: int,
    _: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    fv = crud.get_formulario_by_ano(db, ano)
    if fv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formulário não encontrado.")
    return crud.lock_formulario(db, fv)


# ── Respostas ────────────────────────────────────────────────────────────────────


@router.post("/respostas", response_model=RespostaDemandaOut, status_code=status.HTTP_201_CREATED)
def create_resposta(
    data: RespostaDemandaCreate,
    usuario: Usuario = Depends(require_role("admin", "editor", "pesquisador")),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_resposta(db, data, usuario.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/respostas", response_model=list[RespostaDemandaOut])
def list_respostas(
    parque: str | None = Query(default=None),
    ano: int | None = Query(default=None),
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.list_respostas(db, parque=parque, ano=ano)


# ── Indicadores / dashboard ──────────────────────────────────────────────────────


@router.get("/indicadores", response_model=IndicadoresOut)
def indicadores(
    parque: str | None = Query(default=None),
    ano: int | None = Query(default=None),
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.compute_indicadores(db, parque=parque, ano=ano)


# ── Export (US 2.9) ──────────────────────────────────────────────────────────────


@router.get("/export")
def export(
    formato: str = Query(default="xlsx", pattern="^(xlsx|csv)$"),
    parque: str | None = Query(default=None),
    ano: int | None = Query(default=None),
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ano = ano or date.today().year
    sufixo = f"{parque}_{ano}" if parque else str(ano)
    if formato == "csv":
        content = crud.export_csv(db, parque=parque, ano=ano)
        media = "text/csv"
        filename = f"demanda_{sufixo}.csv"
    else:
        content = crud.export_xlsx(db, parque=parque, ano=ano)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"demanda_{sufixo}.xlsx"
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
