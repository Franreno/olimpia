from app.core.security import verify_password
from app.db.seed import CATEGORIAS, SEED_USERS, run_seed
from app.models.inventario import CategoriaEmpresa
from app.models.usuario import Usuario


def test_run_seed_creates_all_categorias(db_session):
    run_seed(db_session)

    slugs = {c.slug for c in db_session.query(CategoriaEmpresa).all()}
    assert slugs == {slug for slug, _ in CATEGORIAS}
    assert len(slugs) == 7


def test_run_seed_creates_one_user_per_perfil_with_usable_password(db_session):
    run_seed(db_session)

    usuarios = db_session.query(Usuario).all()
    perfis = {u.perfil for u in usuarios}
    assert perfis == {"admin", "editor", "pesquisador", "gestor"}

    for email, _perfil, password in SEED_USERS:
        usuario = db_session.query(Usuario).filter_by(email=email).one()
        assert verify_password(password, usuario.senha_hash) is True
        assert usuario.ativo is True


def test_run_seed_is_idempotent(db_session):
    run_seed(db_session)
    run_seed(db_session)

    assert db_session.query(CategoriaEmpresa).count() == 7
    assert db_session.query(Usuario).count() == len(SEED_USERS)
