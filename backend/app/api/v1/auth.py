import uuid

import redis
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.rbac import get_current_user
from app.core.redis import get_redis_client
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.crud import usuario as usuario_crud
from app.db.session import get_db
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, UsuarioOut

router = APIRouter()
logger = get_logger(__name__)

REFRESH_COOKIE_NAME = "refresh_token"


def get_redis() -> redis.Redis:
    return get_redis_client()


def _refresh_token_key(usuario_id) -> str:
    return f"refresh_token:{usuario_id}"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.environment != "development",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/v1/auth",
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    usuario = usuario_crud.authenticate(db, payload.email, payload.password)
    if usuario is None:
        logger.warning("login_failed", extra={"email": payload.email})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")

    subject = str(usuario.id)
    access_token = create_access_token(subject)
    refresh_token = create_refresh_token(subject)

    settings = get_settings()
    redis_client.set(_refresh_token_key(usuario.id), refresh_token, ex=settings.refresh_token_expire_days * 24 * 60 * 60)

    _set_refresh_cookie(response, refresh_token)

    logger.info("login_success", extra={"usuario_id": subject, "email": usuario.email})
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
):
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de atualização ausente.")

    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de atualização inválido.")

    try:
        usuario_id = uuid.UUID(payload.get("sub", ""))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de atualização inválido.")

    usuario = usuario_crud.get_by_id(db, usuario_id)
    if usuario is None or not usuario.ativo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de atualização inválido.")

    stored = redis_client.get(_refresh_token_key(usuario.id))
    if stored != refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de atualização revogado.")

    access_token = create_access_token(str(usuario.id))
    logger.info("token_refreshed", extra={"usuario_id": str(usuario.id)})
    return TokenResponse(access_token=access_token)


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    redis_client: redis.Redis = Depends(get_redis),
):
    if refresh_token is not None:
        payload = decode_token(refresh_token)
        if payload is not None and payload.get("type") == "refresh":
            redis_client.delete(_refresh_token_key(payload.get("sub")))
            logger.info("logout", extra={"usuario_id": payload.get("sub")})

    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/v1/auth")
    return {"detail": "Logout realizado com sucesso."}


@router.get("/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(get_current_user)):
    return usuario
