from datetime import date

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.demanda import FormularioVersao, Parque
from app.models.inventario import CategoriaEmpresa
from app.models.usuario import Usuario

# Initial parks — editable via the API/UI (admin can rename, add, or deactivate).
# Slugs match pre-existing demand responses so historical data keeps resolving.
PARQUES = [
    ("thermas", "Thermas dos Laranjais", 1),
    ("rubio", "Rubio Termas", 2),
]

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

# Schema do formulário de demanda — renderizado dinamicamente pelo frontend (US 5.5).
DEMANDA_SCHEMA = {
    "campos": [
        # parks are dynamic — options are sourced from the `parque` table, not hard-coded
        {"id": "parque", "label": "Local da pesquisa", "tipo": "selecao", "obrigatorio": True,
         "fonte": "parques"},
        {"id": "cidade_residencia", "label": "Cidade de origem", "tipo": "autocomplete",
         "fonte": "ibge", "obrigatorio": True},
        {"id": "pernoites", "label": "Pernoites", "tipo": "numero", "min": 0, "max": 30, "obrigatorio": True},
        {"id": "gasto_medio_diario", "label": "Gasto diário (R$)", "tipo": "numero", "min": 0, "obrigatorio": True},
        {"id": "renda_familiar", "label": "Renda familiar mensal", "tipo": "selecao", "opcoes": [
            {"valor": r, "rotulo": r} for r in [
                "Até R$ 2.000", "R$ 2.001 – R$ 4.000", "R$ 4.001 – R$ 8.000",
                "R$ 8.001 – R$ 15.000", "Acima de R$ 15.000", "Prefiro não informar",
            ]
        ]},
        {"id": "motivo_viagem", "label": "Motivação da viagem", "tipo": "multipla", "opcoes": [
            "Parques aquáticos", "Turismo de lazer", "Visita a familiares",
            "Lua de mel / Aniversário", "Turismo de saúde", "Eventos", "Outro",
        ]},
        {"id": "nps_recomendacao", "label": "NPS — Recomendação", "tipo": "escala",
         "min": 0, "max": 10, "obrigatorio": True},
    ],
    "regras_coerencia": [
        {"campo": "gasto_medio_diario", "tipo": "gasto_vs_renda", "fator": 0.5,
         "alerta": "O gasto diário declarado parece incompatível com a faixa de renda informada. "
                   "Por favor, verifique os valores com o entrevistado."},
    ],
}


def run_seed(db: Session) -> None:
    for slug, nome in CATEGORIAS:
        if not db.query(CategoriaEmpresa).filter_by(slug=slug).first():
            db.add(CategoriaEmpresa(slug=slug, nome=nome))

    for slug, nome, ordem in PARQUES:
        if not db.query(Parque).filter_by(slug=slug).first():
            db.add(Parque(slug=slug, nome=nome, ordem=ordem))

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

    ano = date.today().year
    if not db.query(FormularioVersao).filter_by(ano=ano).first():
        db.add(FormularioVersao(ano=ano, schema_json=DEMANDA_SCHEMA, status="ativo"))

    db.commit()


def refresh_ibge() -> None:
    """Fetch the full IBGE municipality list into app/data/ibge_municipios.json."""
    import json
    from pathlib import Path
    from urllib.request import urlopen

    url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
    with urlopen(url, timeout=30) as resp:  # noqa: S310 (trusted gov endpoint)
        src = json.load(resp)

    def uf_of(m: dict) -> str | None:
        mr = m.get("microrregiao")
        if mr:
            return mr["mesorregiao"]["UF"]["sigla"]
        ri = m.get("regiao-imediata")
        if ri:
            return ri["regiao-intermediaria"]["UF"]["sigla"]
        return None

    out = [{"nome": m["nome"], "uf": uf_of(m)} for m in src]
    out = [m for m in out if m["uf"]]
    out.sort(key=lambda x: (x["nome"].lower(), x["uf"]))

    dest = Path(__file__).resolve().parent.parent / "data" / "ibge_municipios.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(out)} municípios to {dest}")


if __name__ == "__main__":
    import sys

    if "--refresh-ibge" in sys.argv:
        refresh_ibge()

    from app.db.session import SessionLocal

    session = SessionLocal()
    try:
        run_seed(session)
    finally:
        session.close()
