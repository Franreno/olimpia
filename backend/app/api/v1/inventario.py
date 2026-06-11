import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.rbac import get_current_user, require_role
from app.crud import inventario as inv_crud
from app.db.session import get_db
from app.models.usuario import Usuario
from app.schemas.inventario import (
    AuditLogOut,
    CategoriaEmpresaOut,
    EmpresaCreate,
    EmpresaOut,
    EmpresaUpdate,
)

router = APIRouter()


@router.get("/categorias", response_model=list[CategoriaEmpresaOut])
def list_categorias(
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return inv_crud.list_categorias(db)


@router.get("/empresas", response_model=list[EmpresaOut])
def list_empresas(
    categoria_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return inv_crud.list_empresas(db, categoria_id=categoria_id, status=status, q=q)


@router.post("/empresas", response_model=EmpresaOut, status_code=status.HTTP_201_CREATED)
def create_empresa(
    data: EmpresaCreate,
    usuario: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    return inv_crud.create_empresa(db, data, usuario.id)


@router.get("/empresas/{empresa_id}", response_model=EmpresaOut)
def get_empresa(
    empresa_id: uuid.UUID,
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    empresa = inv_crud.get_empresa(db, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada.")
    return empresa


@router.put("/empresas/{empresa_id}", response_model=EmpresaOut)
def update_empresa(
    empresa_id: uuid.UUID,
    data: EmpresaUpdate,
    usuario: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    empresa = inv_crud.get_empresa(db, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada.")
    return inv_crud.update_empresa(db, empresa, data, usuario.id)


@router.delete("/empresas/{empresa_id}", response_model=EmpresaOut)
def soft_delete_empresa(
    empresa_id: uuid.UUID,
    usuario: Usuario = Depends(require_role("admin", "editor")),
    db: Session = Depends(get_db),
):
    empresa = inv_crud.get_empresa(db, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada.")
    return inv_crud.soft_delete_empresa(db, empresa, usuario.id)


@router.get("/empresas/{empresa_id}/audit", response_model=list[AuditLogOut])
def get_audit(
    empresa_id: uuid.UUID,
    _: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    empresa = inv_crud.get_empresa(db, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada.")
    return inv_crud.get_audit_log(db, empresa_id)
