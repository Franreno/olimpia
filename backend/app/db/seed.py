from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.inventario import CategoriaEmpresa
from app.models.usuario import Usuario

CATEGORIAS = [
    ("meios_hospedagem", "Meios de Hospedagem"),
    ("alimentacao", "Alimentação"),
    ("atrativos", "Atrativos"),
    ("agencias", "Agências e Operadoras"),
    ("transporte", "Transporte"),
    ("eventos", "Eventos"),
    ("servicos_apoio", "Serviços de Apoio"),
]

# (email, perfil, senha em texto puro — apenas para seed local/dev)
SEED_USERS = [
    ("admin@oto.olimpia.sp.gov.br", "admin", "admin123"),
    ("editor@oto.olimpia.sp.gov.br", "editor", "editor123"),
    ("pesquisador@oto.olimpia.sp.gov.br", "pesquisador", "pesquisador123"),
    ("gestor@oto.olimpia.sp.gov.br", "gestor", "gestor123"),
]


def run_seed(db: Session) -> None:
    for slug, nome in CATEGORIAS:
        if not db.query(CategoriaEmpresa).filter_by(slug=slug).first():
            db.add(CategoriaEmpresa(slug=slug, nome=nome))

    for email, perfil, password in SEED_USERS:
        if not db.query(Usuario).filter_by(email=email).first():
            db.add(
                Usuario(
                    nome=perfil.capitalize(),
                    email=email,
                    senha_hash=hash_password(password),
                    perfil=perfil,
                )
            )

    db.commit()


if __name__ == "__main__":
    from app.db.session import SessionLocal

    session = SessionLocal()
    try:
        run_seed(session)
    finally:
        session.close()
