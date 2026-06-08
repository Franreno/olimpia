import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.crud import usuario as usuario_crud
from app.db.session import get_db
from app.models.usuario import Usuario

_bearer_scheme = HTTPBearer(auto_error=False)

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Credenciais inválidas ou expiradas.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    if credentials is None:
        raise _credentials_exception

    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise _credentials_exception

    try:
        usuario_id = uuid.UUID(payload.get("sub", ""))
    except (ValueError, AttributeError, TypeError):
        raise _credentials_exception

    usuario = usuario_crud.get_by_id(db, usuario_id)
    if usuario is None or not usuario.ativo:
        raise _credentials_exception

    return usuario


def require_role(*perfis: str):
    def _dependency(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.perfil not in perfis:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para executar esta ação.",
            )
        return usuario

    return _dependency
