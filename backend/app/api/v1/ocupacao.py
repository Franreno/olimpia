import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user, require_role
from app.crud import ocupacao as crud
from app.db.session import get_db
from app.models.usuario import Usuario
from app.schemas.ocupacao import (
    EstabelecimentoOcupacaoOut,
    PeriodoCreate,
    PeriodoOut,
    ResultadoOut,
    RespostaOcupacaoCreate,
    RespostaOcupacaoOut,
)

router = APIRouter()


# ── Períodos ───────────────────────────────────────────────────────────────────────


@router.get("/periodos", response_model=list[PeriodoOut])
def list_periodos(_: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return crud.list_periodos(db)


@router.post("/periodos", response_model=PeriodoOut, status_code=status.HTTP_201_CREATED)
def create_periodo(
    data: PeriodoCreate,
    usuario: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    try:
        periodo = crud.create_periodo(db, data, usuario.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return crud.get_periodo_out(db, periodo.id)


@router.get("/periodos/{periodo_id}", response_model=PeriodoOut)
def get_periodo(periodo_id: int, _: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    periodo = crud.get_periodo_out(db, periodo_id)
    if periodo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período não encontrado.")
    return periodo


@router.get("/periodos/{periodo_id}/resultado", response_model=ResultadoOut)
def get_resultado(periodo_id: int, _: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    periodo = crud.get_periodo(db, periodo_id)
    if periodo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período não encontrado.")
    return crud.get_resultado(db, periodo)


@router.get("/periodos/{periodo_id}/estabelecimentos", response_model=list[EstabelecimentoOcupacaoOut])
def list_estabelecimentos(
    periodo_id: int, _: Usuario = Depends(get_current_user), db: Session = Depends(get_db)
):
    periodo = crud.get_periodo(db, periodo_id)
    if periodo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período não encontrado.")
    return crud.estabelecimentos_do_periodo(db, periodo)


# ── Respostas ──────────────────────────────────────────────────────────────────────


@router.post(
    "/periodos/{periodo_id}/respostas",
    response_model=RespostaOcupacaoOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_resposta(
    periodo_id: int,
    data: RespostaOcupacaoCreate,
    usuario: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    periodo = crud.get_periodo(db, periodo_id)
    if periodo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período não encontrado.")
    try:
        return crud.upsert_resposta(db, periodo, data, usuario.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Export (estabelecimentos do período) ────────────────────────────────────────────

EXPORT_HEADERS = [
    "estabelecimento", "uhs", "leitos", "peso_pct", "status",
    "taxa_ocupacao", "diaria_media", "receita_estimada",
]


@router.get("/periodos/{periodo_id}/export")
def export_periodo(
    periodo_id: int, _: Usuario = Depends(get_current_user), db: Session = Depends(get_db)
):
    periodo = crud.get_periodo(db, periodo_id)
    if periodo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período não encontrado.")

    rows = crud.estabelecimentos_do_periodo(db, periodo)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_HEADERS)
    for r in rows:
        writer.writerow([
            r["nome_fantasia"], r["uhs"], r["leitos"], r["peso"], r["status"],
            r["taxa_ocupacao"], r["diaria_media"], r["receita_estimada"],
        ])
    content = buffer.getvalue().encode("utf-8-sig")  # BOM → Excel/Power BI read UTF-8
    filename = f"ocupacao_periodo_{periodo_id}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
