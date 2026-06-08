from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.usuario import Usuario


def get_by_email(db: Session, email: str) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.email == email).first()


def get_by_id(db: Session, usuario_id) -> Usuario | None:
    return db.get(Usuario, usuario_id)


def authenticate(db: Session, email: str, password: str) -> Usuario | None:
    usuario = get_by_email(db, email)
    if usuario is None or not usuario.ativo:
        return None
    if not verify_password(password, usuario.senha_hash):
        return None
    return usuario
