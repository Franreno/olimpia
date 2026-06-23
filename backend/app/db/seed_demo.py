"""Realistic, high-volume demo data for the OTO system (Olímpia/SP tourism).

Generates believable data across all three modules so the dashboards can be
tested with thousands of records. Names are composed from curated Portuguese
word banks so every establishment reads like a real Olímpia business — never
"Hotel Test". Person names come from Faker pt_BR (real Brazilian names).

Usage (from backend/, conda env `oto`):

    python -m app.db.seed_demo --reset                 # wipe data tables, regenerate
    python -m app.db.seed_demo --reset --demanda 8000  # tune volume
    python -m app.db.seed_demo --empresas 500 --anos 3

Without --reset it refuses to run when substantial data already exists, so it
never silently doubles your dataset. It preserves usuário, categoria_empresa,
parque and formulario_versao.
"""

import argparse
import json
import random
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.crud.demanda import RENDA_MAX, check_coherence, get_active_formulario
from app.crud.ocupacao import recalcular_resultado
from app.crud.respondente import sincronizar_respondentes
from app.models.demanda import (
    AvaliacaoAtrativo,
    AvaliacaoServico,
    DemandaEstadia,
    DemandaPerfilSocioeconomico,
    DemandaSatisfacao,
    DemandaViagem,
    Parque,
    RespostaDemanda,
)
from app.models.inventario import (
    AuditLog,
    CategoriaEmpresa,
    Empresa,
    RespondentePesquisa,
)
from app.models.ocupacao import PeriodoOcupacao, RespostaOcupacao, ResultadoOcupacao
from app.models.usuario import Usuario

try:
    from faker import Faker
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Faker não instalado. Rode: pip install faker==33.1.0") from exc

fake = Faker("pt_BR")
SEED = 42

MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

# ── Olímpia reference data ─────────────────────────────────────────────────────────

BAIRROS = [
    "Centro", "Jardim Alvorada", "Jardim Itália", "Nova Olímpia", "Jardim das Palmeiras",
    "Parque Residencial Tucuruvi", "Distrito Industrial", "Jardim Santa Cruz",
    "Recanto dos Pássaros", "Jardim Santo Antônio", "Vila Botega", "Jardim Andréa",
    "Loteamento Thermas", "Jardim Primavera", "Jardim São Lucas", "Vila Mariana",
    "Jardim Bertan", "Parque das Águas", "Jardim Califórnia", "Vila Industrial",
]

# Themed word bank shared by lodging / events for a consistent regional feel.
NATUREZA = [
    "das Águas", "dos Laranjais", "Sol Nascente", "Recanto Azul", "Vale Verde",
    "Bela Vista", "Águas Claras", "Ipê Amarelo", "Pôr do Sol", "Lago Azul",
    "da Cachoeira", "Primavera", "Aurora", "Refúgio da Serra", "Jardim Tropical",
    "Estância das Flores", "Colina Verde", "Paraíso das Águas", "Vista Alegre",
    "Solar dos Pássaros", "Monte Verde", "Águas Quentes", "do Bosque", "Terra Nova",
]

HOSPEDAGEM_PREFIX = [
    ("Hotel", "hotel"), ("Resort", "resort"), ("Pousada", "pousada"),
    ("Hotel Fazenda", "hotel"), ("Flat", "flat"), ("Thermas Hotel", "resort"),
    ("Pousada Recanto", "pousada"), ("Resort & Spa", "resort"), ("Hotel", "hotel"),
    ("Pousada", "pousada"), ("Flat Residencial", "flat"),
]

# Restaurant patterns — each lambda yields a natural name.
ALIMENTACAO_PATTERNS = [
    lambda: f"Cantina d{random.choice(['a Nonna', 'o Tonho', 'a Vó Maria', 'o Italiano'])}",
    lambda: f"Churrascaria {random.choice(['Boi na Brasa', 'Tradição Gaúcha', 'Estância', 'Rodeio', 'Fogo de Chão Caipira'])}",
    lambda: f"Pizzaria {random.choice(['Bella Napoli', 'Forno a Lenha', 'Don Camillo', 'La Famiglia', 'Sapore'])}",
    lambda: f"Restaurante {random.choice(['Sabor Mineiro', 'Tempero da Roça', 'Recanto Caipira', 'Prato Cheio', 'Casa da Vó', 'Paladar', 'Comida di Buteco'])}",
    lambda: f"Sorveteria {random.choice(['Gelato & Cia', 'Frutos do Cerrado', 'Bom Gelo', 'Tropicana'])}",
    lambda: f"Padaria {random.choice(['Pão Quente', 'Estrela', 'Flor de Trigo', 'São José'])}",
    lambda: f"Lanchonete {random.choice(['do Ponto', 'Central', 'da Praça', 'Skinão'])}",
    lambda: f"Espetinho d{random.choice(['o Gaúcho', 'a Esquina', 'o Português'])}",
    lambda: f"Bar e Restaurante {random.choice(['do Porto', 'da Vila', 'Recanto', 'Estação'])}",
    lambda: f"Cafeteria {random.choice(['Grão Nobre', 'Aroma', 'Central', 'Doce Encontro'])}",
]

ATRATIVOS = [
    ("Thermas dos Laranjais", "Parque aquático"),
    ("Hot Beach Olímpia", "Parque aquático"),
    ("Parque dos Sonhos", "Parque aquático"),
    ("Balneário Municipal", "Atrativo natural"),
    ("Mirante da Serra", "Atrativo natural"),
    ("Trilha do Ribeirão", "Atrativo natural"),
    ("Lago Municipal", "Atrativo natural"),
    ("Parque Ecológico de Olímpia", "Atrativo natural"),
    ("Capela Nossa Senhora Aparecida", "Atrativo religioso"),
    ("Igreja Matriz de Olímpia", "Atrativo religioso"),
    ("Museu Histórico de Olímpia", "Atrativo cultural"),
    ("Praça da Matriz", "Espaço público"),
    ("Recinto de Eventos Zeca Mariano", "Espaço público"),
    ("Centro de Convenções de Olímpia", "Espaço público"),
    ("Rua do Lazer", "Espaço público"),
]

AGENCIA_THEMES = [
    "Olímpia", "Laranjais", "Sol & Mar", "Caminhos do Interior", "Bem Viver",
    "Terra Brasil", "Estrada Real", "Águas Tour", "Cerrado", "Recanto", "Cidade Sol",
]
AGENCIA_SUFFIX = ["Turismo", "Viagens e Turismo", "Receptivo", "Operadora", "Tour"]

TRANSPORTE_PATTERNS = [
    lambda: f"Expresso {random.choice(['Olímpia', 'Laranjais', 'Cidade Sol'])} Transportes",
    lambda: f"{random.choice(['Olímpia', 'Laranjais', 'Estrada Real', 'Interior'])} Transfer & Turismo",
    lambda: f"Locadora {random.choice(['Estrada Real', 'Cidade Sol', 'Bom Destino'])}",
    lambda: f"Van Tur {random.choice(['Olímpia', 'Laranjais', 'do Interior'])}",
    lambda: "Translaranjais Fretamentos",
]

EVENTOS_PREFIX = ["Espaço", "Centro de Eventos", "Buffet", "Salão", "Chácara"]
EVENTOS_THEME = [
    "Villa Bella", "Laranjais", "Recanto Verde", "Imperial", "das Águas",
    "Sol Nascente", "Jardim", "Monte Verde", "Bela Vista", "Encantos", "Vale dos Sonhos",
]

# Support services — name banks per subcategory so they read naturally.
SERVICOS = {
    "farmacia": (["Farmácia", "Drogaria"], ["São João", "Popular", "Vida", "Saúde", "Central", "do Povo", "Olímpia", "Bem Estar"]),
    "supermercado": (["Supermercado", "Mercado", "Hortifruti"], ["Preço Bom", "Económico", "Central", "Bom Preço", "do Bairro", "Líder", "Avenida", "Família"]),
    "posto": (["Posto", "Auto Posto"], ["Ipê", "Trevo", "Cidade Sol", "Estrada Real", "Laranjais", "Avenida", "Central"]),
    "banco": (["Banco do Brasil", "Caixa Econômica", "Bradesco", "Itaú", "Sicoob", "Santander", "Sicredi"], None),
    "clinica": (["Clínica", "Centro Médico", "Laboratório"], ["Vida & Saúde", "Bem Estar", "Santa Clara", "São Lucas", "Olímpia", "Coração", "Santa Casa"]),
}

CULINARIAS = ["Regional", "Italiana", "Mineira", "Churrasco", "Japonesa", "Caseira", "Frutos do mar", "Pizzaria", "Fast food", "Self-service"]

ESTADOS_PESO = [  # (uf, peso) — emissão turística típica de Olímpia: SP domina
    ("SP", 46), ("MG", 17), ("PR", 8), ("RJ", 7), ("GO", 5), ("MS", 4),
    ("DF", 3), ("SC", 3), ("RS", 2), ("BA", 2), ("ES", 1), ("MT", 1), ("PE", 1),
]
MEIOS_HOSPEDAGEM = ["Hotel", "Resort", "Pousada", "Flat", "Casa de amigos/parentes", "Aluguel por temporada", "Camping"]
ACOMPANHANTES = ["Família com crianças", "Casal", "Grupo de amigos", "Sozinho", "Excursão", "Família sem crianças"]
GENEROS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"]
FAIXAS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
RENDAS = list(RENDA_MAX.keys()) + ["Prefiro não informar"]
MOTIVOS = ["Parques aquáticos", "Turismo de lazer", "Visita a familiares", "Lua de mel / Aniversário", "Turismo de saúde", "Eventos", "Outro"]
TRANSPORTES = ["Carro próprio", "Ônibus de viagem", "Avião", "Van/Transfer", "Excursão", "Motorhome"]
CONCORRENTES = ["Caldas Novas (GO)", "Foz do Iguaçu (PR)", "Praia Grande (SP)", "Brotas (SP)", "Águas de Lindóia (SP)", "Rio Quente (GO)", "Beto Carrero (SC)", "Poços de Caldas (MG)"]
DIMENSOES = ["hospedagem", "alimentacao", "seguranca", "limpeza", "sinalizacao", "estrutura", "mobilidade", "acessibilidade", "atendimento", "compras"]
ATRATIVOS_AVALIADOS = [a[0] for a in ATRATIVOS[:8]]

MES_SAZONAL = {1: 1.6, 2: 1.3, 3: 0.8, 4: 0.9, 5: 0.6, 6: 0.7, 7: 1.5, 8: 0.7, 9: 0.7, 10: 0.9, 11: 0.8, 12: 1.4}


# ── helpers ─────────────────────────────────────────────────────────────────────────


def _slug(text: str) -> str:
    base = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    return "".join(ch for ch in base.lower() if ch.isalnum())


def _email_for(nome: str) -> str:
    dom = _slug(nome)[:24] or "estabelecimento"
    return f"contato@{dom}.com.br"


def _weighted(pairs):
    vals, weights = zip(*pairs)
    return random.choices(vals, weights=weights, k=1)[0]


def _load_cities_by_uf() -> dict[str, list[str]]:
    path = Path(__file__).resolve().parent.parent / "data" / "ibge_municipios.json"
    by_uf: dict[str, list[str]] = {}
    if path.exists():
        for m in json.loads(path.read_text(encoding="utf-8")):
            by_uf.setdefault(m["uf"], []).append(m["nome"])
    return by_uf


# ── name generation (curated, natural) ───────────────────────────────────────────────


def _hospedagem_name() -> tuple[str, str]:
    prefix, tipo = random.choice(HOSPEDAGEM_PREFIX)
    if random.random() < 0.12:
        nome = f"{prefix} {random.choice(['do Juca', 'Dona Benta', 'do Português', 'da Serra', 'do Lago'])}"
    else:
        nome = f"{prefix} {random.choice(NATUREZA)}"
    return nome, tipo


def _servico_name(sub: str) -> str:
    prefixes, themes = SERVICOS[sub]
    if themes is None:  # banks / fixed brands
        return f"{random.choice(prefixes)} - Olímpia"
    return f"{random.choice(prefixes)} {random.choice(themes)}"


def _unique(make, used: set, max_tries: int = 40) -> str:
    for _ in range(max_tries):
        n = make()
        if n not in used:
            used.add(n)
            return n
    # natural fallback: disambiguate by neighbourhood
    n = f"{make()} - {random.choice(BAIRROS)}"
    used.add(n)
    return n


def _razao_social(setor: str) -> str:
    legal = random.choice(["Ltda", "Ltda - ME", "EIRELI", "S.A."])
    return f"{fake.last_name()} {fake.last_name()} {setor} {legal}"


# ── reset ─────────────────────────────────────────────────────────────────────────────

# Order matters (children before parents).
_RESET_MODELS = [
    AvaliacaoServico, AvaliacaoAtrativo, DemandaEstadia, DemandaViagem,
    DemandaSatisfacao, DemandaPerfilSocioeconomico, RespostaDemanda,
    ResultadoOcupacao, RespostaOcupacao, RespondentePesquisa, PeriodoOcupacao,
    AuditLog, Empresa,
]


def reset_demo_data(db: Session) -> None:
    for model in _RESET_MODELS:
        db.execute(delete(model))
    db.commit()


# ── Module 1: Inventário ──────────────────────────────────────────────────────────────

CATEGORY_WEIGHTS = {
    "meios_hospedagem": 0.16,
    "alimentacao": 0.27,
    "atrativos": 0.06,
    "agencias": 0.06,
    "transporte": 0.07,
    "eventos": 0.06,
    "servicos_apoio": 0.32,
}


def _campos_extras(slug: str, used: set) -> tuple[str, dict]:
    if slug == "meios_hospedagem":
        nome, tipo = _hospedagem_name()
        uhs = random.randint(12, 280)
        return nome, {"tipo": tipo, "uhs": uhs, "leitos": uhs * random.choice([2, 2, 2, 3])}
    if slug == "alimentacao":
        return random.choice(ALIMENTACAO_PATTERNS)(), {"capacidade": random.randint(20, 320), "tipo_culinaria": random.choice(CULINARIAS)}
    if slug == "atrativos":
        nome, tipo = random.choice(ATRATIVOS)
        return nome, {"tipo": tipo}
    if slug == "agencias":
        nome = f"{random.choice(AGENCIA_THEMES)} {random.choice(AGENCIA_SUFFIX)}"
        return nome, {"tipo": random.choice(["Agência", "Operadora"])}
    if slug == "transporte":
        return random.choice(TRANSPORTE_PATTERNS)(), {}
    if slug == "eventos":
        nome = f"{random.choice(EVENTOS_PREFIX)} {random.choice(EVENTOS_THEME)}"
        return nome, {"capacidade_pessoas": random.choice([80, 120, 150, 200, 300, 400, 500, 800, 1200])}
    # servicos_apoio
    sub = random.choice(list(SERVICOS.keys()))
    return _servico_name(sub), {"subcategoria": sub}


def gen_empresas(db: Session, total: int, users: list[Usuario]) -> list[Empresa]:
    categorias = {c.slug: c for c in db.query(CategoriaEmpresa).all()}
    editors = [u for u in users if u.perfil in ("admin", "editor")] or users
    used_names: set[str] = set()
    empresas: list[Empresa] = []
    audits: list[AuditLog] = []
    now = datetime.utcnow()

    for slug, weight in CATEGORY_WEIGHTS.items():
        cat = categorias.get(slug)
        if cat is None:
            continue
        count = max(1, round(total * weight))
        for _ in range(count):
            nome, extras = _campos_extras(slug, used_names)
            nome = _unique(lambda n=nome: n, used_names) if nome in used_names else nome
            used_names.add(nome)

            criado_em = fake.date_time_between(start_date="-3y", end_date="-30d")
            ativo = random.random() > 0.06
            autor = random.choice(editors)
            emp = Empresa(
                id=uuid4(),
                categoria_id=cat.id,
                nome_fantasia=nome,
                razao_social=_razao_social({
                    "meios_hospedagem": "Hotelaria", "alimentacao": "Alimentos",
                    "atrativos": "Turismo", "agencias": "Turismo", "transporte": "Transportes",
                    "eventos": "Eventos", "servicos_apoio": "Comércio",
                }[slug]),
                cnpj=fake.cnpj(),
                endereco=f"{fake.street_name()}, {random.randint(1, 2500)}",
                bairro=random.choice(BAIRROS),
                telefone=fake.phone_number(),
                email=_email_for(nome),
                status="ativo" if ativo else "inativo",
                data_baixa=(criado_em.date() + timedelta(days=random.randint(60, 800))) if not ativo else None,
                aceita_pesquisas=random.random() > 0.12,
                contato_pesquisas=fake.name(),
                telefone_pesquisas=fake.phone_number(),
                email_pesquisas=_email_for(nome),
                proprietario=fake.name(),
                campos_extras=extras,
                criado_em=criado_em,
                atualizado_em=None,
                criado_por=autor.id,
            )
            empresas.append(emp)
            snapshot = {"nome_fantasia": nome, "categoria_id": cat.id, "status": emp.status, **extras}
            audits.append(AuditLog(
                tabela="empresa", registro_id=emp.id, usuario_id=autor.id,
                operacao="INSERT", valor_novo=snapshot, criado_em=criado_em,
            ))

    db.bulk_save_objects(empresas)
    db.bulk_save_objects(audits)
    db.commit()
    return empresas


# ── Module 2: Demanda ─────────────────────────────────────────────────────────────────


def _gen_coletado_em(start: date, end: date) -> datetime:
    """Pick a timestamp in [start, end] biased by monthly seasonality."""
    months = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append((y, m))
        m += 1
        if m == 13:
            m, y = 1, y + 1
    weights = [MES_SAZONAL[m] for (_, m) in months]
    yy, mm = random.choices(months, weights=weights, k=1)[0]
    last_day = 28 if mm == 2 else 30 if mm in (4, 6, 9, 11) else 31
    if (yy, mm) == (end.year, end.month):
        last_day = min(last_day, end.day)
    day = random.randint(1, max(1, last_day))
    return datetime(yy, mm, day, random.randint(8, 19), random.choice([0, 15, 30, 45]))


def _gasto_for(renda: str) -> tuple[str, bool]:
    """Daily spend (string) correlated to income; ~4% intentionally incoherent."""
    base = {
        "Até R$ 2.000": (60, 180), "R$ 2.001 – R$ 4.000": (100, 280),
        "R$ 4.001 – R$ 8.000": (160, 420), "R$ 8.001 – R$ 15.000": (250, 650),
        "Acima de R$ 15.000": (350, 1100),
    }.get(renda, (80, 350))
    gasto = random.randint(*base)
    incoerente = False
    if renda in RENDA_MAX and random.random() < 0.04:
        gasto = int(RENDA_MAX[renda] * random.uniform(0.55, 0.9))  # trips the coherence rule
        incoerente = True
    return str(gasto), incoerente


def _nps_sample(park_bias: float) -> int:
    """Healthy NPS skew (Olímpia rates well) → ~55% promoters, ~28% passives,
    ~17% detractors ⇒ NPS ≈ +38, slightly varied per park."""
    r = random.random() + park_bias
    if r > 0.45:
        return random.choice([9, 10, 10, 9])      # promoter
    if r > 0.17:
        return random.choice([7, 8, 8, 7])         # passive
    return random.choice([0, 3, 4, 5, 6, 6])       # detractor


def gen_demanda(db: Session, total: int, anos: float, users: list[Usuario]) -> int:
    fv = get_active_formulario(db)
    if fv is None:
        raise SystemExit("Nenhum formulário ativo — rode o seed base primeiro (python -m app.db.seed).")
    regras = (fv.schema_json or {}).get("regras_coerencia", [])

    pesquisadores = [u for u in users if u.perfil in ("pesquisador", "admin", "editor")] or users
    parques = [p.slug for p in db.query(Parque).filter(Parque.ativo.is_(True)).all()]
    if not parques:
        raise SystemExit("Nenhum parque ativo encontrado.")
    park_bias = {slug: random.uniform(-0.06, 0.06) for slug in parques}

    cities_by_uf = _load_cities_by_uf()
    today = date.today()
    start = today - timedelta(days=int(365 * anos))

    respostas, estadias, viagens, satisfacoes, perfis, av_serv, av_atr = [], [], [], [], [], [], []

    for _ in range(total):
        rid = uuid4()
        parque = random.choice(parques)
        coletado = _gen_coletado_em(start, today)

        uf = _weighted(ESTADOS_PESO)
        cidade = random.choice(cities_by_uf.get(uf, ["São Paulo"]))
        pernoites = random.choices([1, 2, 3, 4, 5, 6, 7], weights=[8, 22, 26, 20, 12, 7, 5])[0]
        chegada = datetime.combine(coletado.date() - timedelta(days=random.randint(0, pernoites)), datetime.min.time())

        renda = random.choices(RENDAS, weights=[10, 24, 28, 18, 8, 12])[0]
        gasto, incoerente = _gasto_for(renda)
        alerta, descricao = check_coherence(renda, gasto, regras)

        respostas.append(RespostaDemanda(
            id=rid, formulario_versao_id=fv.id, pesquisador_id=random.choice(pesquisadores).id,
            parque=parque, coletado_em=coletado, sync_status="sincronizado",
            alerta_coerencia=alerta, descricao_alerta=descricao,
        ))
        estadias.append(DemandaEstadia(
            resposta_id=rid, estado_residencia=uf, cidade_residencia=cidade,
            data_chegada=chegada, data_partida=chegada + timedelta(days=pernoites),
            pernoites=pernoites, meio_hospedagem=random.choice(MEIOS_HOSPEDAGEM),
            acompanhantes_tipo=random.choice(ACOMPANHANTES),
        ))
        viagens.append(DemandaViagem(
            resposta_id=rid,
            motivo_viagem=random.sample(MOTIVOS, k=random.randint(1, 3)),
            transporte_utilizado=random.choice(TRANSPORTES),
            considerou_outro_destino=random.random() < 0.4,
            destinos_concorrentes=(random.sample(CONCORRENTES, k=random.randint(1, 3)) if random.random() < 0.5 else []),
        ))
        nps = _nps_sample(park_bias[parque])
        satisfacoes.append(DemandaSatisfacao(
            resposta_id=rid, voltaria=nps >= 6, indicaria=nps >= 7,
            nps_recomendacao=nps, nota_destino=min(10, max(0, nps + random.choice([-1, 0, 0, 1]))),
        ))
        perfis.append(DemandaPerfilSocioeconomico(
            resposta_id=rid, genero=random.choices(GENEROS, weights=[48, 48, 2, 2])[0],
            faixa_etaria=random.choices(FAIXAS, weights=[12, 26, 28, 18, 10, 6])[0],
            renda_familiar=renda, gasto_medio_diario=gasto,
        ))
        for dim in random.sample(DIMENSOES, k=random.randint(3, 5)):
            av_serv.append(AvaliacaoServico(resposta_id=rid, dimensao=dim, nota=random.choices([3, 4, 5], weights=[2, 4, 5])[0]))
        for atr in random.sample(ATRATIVOS_AVALIADOS, k=random.randint(1, 3)):
            av_atr.append(AvaliacaoAtrativo(resposta_id=rid, nome_atrativo=atr, nota=random.choices([3, 4, 5], weights=[2, 4, 6])[0]))

    for batch in (respostas, estadias, viagens, satisfacoes, perfis, av_serv, av_atr):
        db.bulk_save_objects(batch)
        db.commit()
    return len(respostas)


# ── Module 3: Ocupação ────────────────────────────────────────────────────────────────

FERIADOS = [  # (mês, descrição, dias) — datas aproximadas; geradas como expectativa
    (2, "Carnaval", 4), (4, "Páscoa", 4), (5, "Feriado do Trabalho", 3),
    (9, "Independência", 3), (10, "Nossa Senhora Aparecida", 3), (12, "Réveillon", 5),
]


def _diaria_for(tipo: str) -> Decimal:
    base = {"resort": (420, 950), "hotel": (240, 560), "flat": (190, 410), "pousada": (170, 390)}.get(tipo, (200, 500))
    return Decimal(str(random.randint(*base)))


def gen_ocupacao(db: Session, anos: int, users: list[Usuario]) -> tuple[int, int]:
    editors = [u for u in users if u.perfil in ("admin", "editor")] or users
    hoteis = (
        db.query(Empresa)
        .join(CategoriaEmpresa, Empresa.categoria_id == CategoriaEmpresa.id)
        .filter(CategoriaEmpresa.slug == "meios_hospedagem", Empresa.status == "ativo")
        .all()
    )
    today = date.today()
    years = list(range(today.year - anos, today.year + 1))

    periodos: list[PeriodoOcupacao] = []
    protocolo_seq: dict[int, int] = {}

    def _proto(year: int) -> str:
        protocolo_seq[year] = protocolo_seq.get(year, 0) + 1
        return f"{protocolo_seq[year]:03d}/{year % 100:02d}"

    for year in years:
        max_month = today.month if year == today.year else 12
        for m in range(1, max_month + 1):
            last = 28 if m == 2 else 30 if m in (4, 6, 9, 11) else 31
            periodos.append(PeriodoOcupacao(
                tipo="consolidado", descricao=f"{MESES_PT[m - 1]} {year}",
                data_inicio=date(year, m, 1), data_fim=date(year, m, last),
                status="publicado" if (year, m) < (today.year, today.month) else "aberto",
                protocolo=_proto(year),
                criado_por=random.choice(editors).id,
                criado_em=datetime(year, m, 1, 9, 0),
            ))
        for fm, desc, dur in FERIADOS:
            if year == today.year and fm > today.month:
                continue
            di = date(year, fm, random.randint(8, 18))
            periodos.append(PeriodoOcupacao(
                tipo="expectativa", descricao=f"{desc} {year}",
                data_inicio=di, data_fim=di + timedelta(days=dur),
                status="publicado", protocolo=_proto(year),
                criado_por=random.choice(editors).id, criado_em=datetime(year, fm, 1, 9, 0),
            ))

    db.bulk_save_objects(periodos)
    db.commit()

    # responses per period (seasonal occupancy, ~82% participation)
    periodos = db.query(PeriodoOcupacao).all()
    respostas: list[RespostaOcupacao] = []
    for p in periodos:
        mult = MES_SAZONAL[p.data_inicio.month]
        feriado_boost = 12 if p.tipo == "expectativa" else 0
        for h in hoteis:
            if not h.aceita_pesquisas or random.random() > 0.82:
                continue
            tipo = (h.campos_extras or {}).get("tipo", "hotel")
            base = 38 + (mult - 0.6) * 38 + feriado_boost
            taxa = max(8, min(98, base + random.uniform(-14, 14)))
            respondido = datetime.combine(p.data_fim, datetime.min.time()) + timedelta(hours=random.randint(1, 72))
            respostas.append(RespostaOcupacao(
                periodo_id=p.id, empresa_id=h.id,
                taxa_ocupacao=Decimal(f"{taxa:.2f}"),
                uhs_informadas=(h.campos_extras or {}).get("uhs"),
                leitos_informados=(h.campos_extras or {}).get("leitos"),
                diaria_media=_diaria_for(tipo),
                respondido_em=respondido, respondido_por=random.choice(editors).id,
            ))
    db.bulk_save_objects(respostas)
    db.commit()

    for p in periodos:
        recalcular_resultado(db, p.id)

    return len(periodos), len(respostas)


# ── orchestration ─────────────────────────────────────────────────────────────────────


def run(db: Session, *, empresas: int, demanda: int, anos: int, reset: bool) -> None:
    existing = db.query(Empresa).count()
    if existing > 15 and not reset:
        raise SystemExit(
            f"Já existem {existing} empresas. Rode com --reset para limpar e regenerar "
            "(preserva usuários, categorias, parques e formulários)."
        )
    if reset:
        print("→ limpando tabelas de dados (mantendo usuários/categorias/parques/formulários)…")
        reset_demo_data(db)

    random.seed(SEED)
    Faker.seed(SEED)

    users = db.query(Usuario).all()
    if not users:
        raise SystemExit("Nenhum usuário — rode o seed base primeiro (python -m app.db.seed).")

    print(f"→ gerando ~{empresas} empresas (M1)…")
    emp = gen_empresas(db, empresas, users)
    print(f"  {len(emp)} empresas criadas.")

    print(f"→ gerando ~{demanda} respostas de demanda em {anos} anos (M2)…")
    n_dem = gen_demanda(db, demanda, anos, users)
    print(f"  {n_dem} respostas + sub-tabelas criadas.")

    print(f"→ gerando períodos e respostas de ocupação em {anos} anos (M3)…")
    n_per, n_resp = gen_ocupacao(db, anos, users)
    print(f"  {n_per} períodos, {n_resp} respostas de ocupação, resultados recalculados.")

    print("→ matriculando respondentes (taxa de ocupação)…")
    res = sincronizar_respondentes(db, "taxa_ocupacao")
    print(f"  {res['criados']} respondentes matriculados.")

    print("✓ Demo data pronta.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera dados realistas de demonstração (Olímpia/SP).")
    parser.add_argument("--reset", action="store_true", help="limpa as tabelas de dados antes de gerar")
    parser.add_argument("--empresas", type=int, default=450, help="quantidade-alvo de empresas (M1)")
    parser.add_argument("--demanda", type=int, default=6000, help="quantidade de respostas de demanda (M2)")
    parser.add_argument("--anos", type=int, default=2, help="span de anos para demanda e ocupação")
    args = parser.parse_args()

    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        run(db, empresas=args.empresas, demanda=args.demanda, anos=args.anos, reset=args.reset)
    finally:
        db.close()


if __name__ == "__main__":
    main()
