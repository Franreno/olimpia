import csv
import io
import re
import unicodedata
import uuid
from collections import Counter
from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.demanda import (
    AvaliacaoAtrativo,
    AvaliacaoServico,
    DemandaEstadia,
    DemandaPerfilSocioeconomico,
    DemandaSatisfacao,
    DemandaViagem,
    FormularioVersao,
    Parque,
    RespostaDemanda,
)
from app.models.usuario import Usuario
from app.schemas.demanda import (
    FormularioVersaoCreate,
    ParqueCreate,
    ParqueUpdate,
    RespostaDemandaCreate,
)

# Monthly-income ceiling (R$) for each declared range — used by the coherence check.
RENDA_MAX = {
    "Até R$ 2.000": 2000,
    "R$ 2.001 – R$ 4.000": 4000,
    "R$ 4.001 – R$ 8.000": 8000,
    "R$ 8.001 – R$ 15.000": 15000,
    "Acima de R$ 15.000": 25000,
}

MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


# ── Parque (dynamic survey locations) ─────────────────────────────────────────────


def slugify(text: str) -> str:
    base = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    base = re.sub(r"[^a-zA-Z0-9]+", "_", base).strip("_").lower()
    return base or "parque"


def list_parques(db: Session, apenas_ativos: bool = False) -> list[Parque]:
    query = db.query(Parque)
    if apenas_ativos:
        query = query.filter(Parque.ativo.is_(True))
    return query.order_by(Parque.ordem, Parque.nome).all()


def get_parque(db: Session, parque_id: int) -> Parque | None:
    return db.get(Parque, parque_id)


def create_parque(db: Session, data: ParqueCreate) -> Parque:
    slug = slugify(data.nome)
    # ensure unique slug (append a numeric suffix on collision)
    base, n = slug, 2
    while db.query(Parque).filter(Parque.slug == slug).first() is not None:
        slug = f"{base}_{n}"
        n += 1
    parque = Parque(slug=slug, nome=data.nome.strip(), ordem=data.ordem)
    db.add(parque)
    db.commit()
    db.refresh(parque)
    return parque


def update_parque(db: Session, parque: Parque, data: ParqueUpdate) -> Parque:
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(parque, field, value)  # slug is immutable — not exposed in ParqueUpdate
    db.commit()
    db.refresh(parque)
    return parque


def active_parque_slugs(db: Session) -> set[str]:
    return {slug for (slug,) in db.query(Parque.slug).filter(Parque.ativo.is_(True)).all()}


# ── Formulário versão ───────────────────────────────────────────────────────────


def _parse_money(value: str | None) -> float | None:
    if not value:
        return None
    digits = re.sub(r"[^\d,.-]", "", value).replace(".", "").replace(",", ".")
    try:
        return float(digits)
    except ValueError:
        return None


def get_active_formulario(db: Session, ano: int | None = None) -> FormularioVersao | None:
    ano = ano or date.today().year
    return (
        db.query(FormularioVersao)
        .filter(FormularioVersao.ano == ano, FormularioVersao.status == "ativo")
        .first()
    )


def get_formulario_by_ano(db: Session, ano: int) -> FormularioVersao | None:
    return db.query(FormularioVersao).filter(FormularioVersao.ano == ano).first()


def list_formularios(db: Session) -> list[FormularioVersao]:
    counts = dict(
        db.query(RespostaDemanda.formulario_versao_id, func.count(RespostaDemanda.id))
        .group_by(RespostaDemanda.formulario_versao_id)
        .all()
    )
    rows = (
        db.query(FormularioVersao, Usuario.nome)
        .outerjoin(Usuario, FormularioVersao.criado_por == Usuario.id)
        .order_by(FormularioVersao.ano.desc())
        .all()
    )
    out = []
    for fv, nome in rows:
        fv.criado_por_nome = nome
        fv.total_respostas = counts.get(fv.id, 0)
        out.append(fv)
    return out


def create_formulario(db: Session, data: FormularioVersaoCreate, usuario_id: uuid.UUID) -> FormularioVersao:
    """New versions may only be prepared for next year (CLAUDE.md §8.3)."""
    if data.ano != date.today().year + 1:
        raise ValueError("Novas versões só podem ser criadas para o próximo ano.")
    if get_formulario_by_ano(db, data.ano) is not None:
        raise ValueError(f"Já existe um formulário para o ano {data.ano}.")

    fv = FormularioVersao(
        ano=data.ano, schema_json=data.schema_json, status="ativo", criado_por=usuario_id
    )
    db.add(fv)
    db.commit()
    db.refresh(fv)
    return fv


def lock_formulario(db: Session, fv: FormularioVersao) -> FormularioVersao:
    fv.status = "travado"
    db.commit()
    db.refresh(fv)
    return fv


# ── Coerência (US 2.3, config-driven via schema_json.regras_coerencia) ────────────


def check_coherence(renda_familiar: str | None, gasto_medio_diario: str | None, regras: list[dict]):
    """Returns (alerta: bool, descricao: str | None) for the response's perfil."""
    gasto = _parse_money(gasto_medio_diario)
    renda_max = RENDA_MAX.get(renda_familiar) if renda_familiar else None
    if gasto is None or renda_max is None:
        return False, None

    for regra in regras or []:
        if regra.get("tipo") != "gasto_vs_renda":
            continue
        fator = regra.get("fator", 0.5)
        if gasto > renda_max * fator:
            return True, regra.get(
                "alerta",
                "O gasto diário declarado parece incompatível com a faixa de renda informada.",
            )
    return False, None


# ── Respostas ────────────────────────────────────────────────────────────────────


def create_resposta(db: Session, data: RespostaDemandaCreate, pesquisador_id: uuid.UUID) -> RespostaDemanda:
    if data.formulario_versao_id is not None:
        fv = db.get(FormularioVersao, data.formulario_versao_id)
    else:
        fv = get_active_formulario(db)
    if fv is None:
        raise ValueError("Nenhum formulário de demanda ativo encontrado para o período.")

    if data.parque not in active_parque_slugs(db):
        raise ValueError("Parque inválido ou inativo.")

    regras = (fv.schema_json or {}).get("regras_coerencia", [])
    renda = data.perfil.renda_familiar if data.perfil else None
    gasto = data.perfil.gasto_medio_diario if data.perfil else None
    alerta, descricao = check_coherence(renda, gasto, regras)

    resposta = RespostaDemanda(
        formulario_versao_id=fv.id,
        pesquisador_id=pesquisador_id,
        parque=data.parque,
        coletado_em=data.coletado_em or datetime.utcnow(),
        sync_status="sincronizado",
        alerta_coerencia=alerta,
        descricao_alerta=descricao,
    )
    db.add(resposta)
    db.flush()  # populate resposta.id for the sub-tables

    if data.estadia:
        db.add(DemandaEstadia(resposta_id=resposta.id, **data.estadia.model_dump()))
    if data.viagem:
        db.add(DemandaViagem(resposta_id=resposta.id, **data.viagem.model_dump()))
    if data.satisfacao:
        db.add(DemandaSatisfacao(resposta_id=resposta.id, **data.satisfacao.model_dump()))
    if data.perfil:
        db.add(DemandaPerfilSocioeconomico(resposta_id=resposta.id, **data.perfil.model_dump()))
    for av in data.avaliacoes_servico:
        db.add(AvaliacaoServico(resposta_id=resposta.id, **av.model_dump()))
    for av in data.avaliacoes_atrativo:
        db.add(AvaliacaoAtrativo(resposta_id=resposta.id, **av.model_dump()))

    db.commit()
    db.refresh(resposta)
    return resposta


def list_respostas(db: Session, parque: str | None = None, ano: int | None = None) -> list[RespostaDemanda]:
    query = db.query(RespostaDemanda)
    if parque:
        query = query.filter(RespostaDemanda.parque == parque)
    if ano:
        query = query.filter(func.extract("year", RespostaDemanda.coletado_em) == ano)
    return query.order_by(RespostaDemanda.coletado_em.desc()).all()


# ── Indicadores (US 2.6, 2.7) ─────────────────────────────────────────────────────


def _nps_from(notas: list[int]):
    """NPS = %promotores (9-10) - %detratores (0-6). Returns (nps, prom, neutros, detr)."""
    if not notas:
        return None, 0, 0, 0
    prom = sum(1 for n in notas if n >= 9)
    detr = sum(1 for n in notas if n <= 6)
    neutros = len(notas) - prom - detr
    nps = round((prom / len(notas) - detr / len(notas)) * 100, 1)
    return nps, prom, neutros, detr


def _nps_label(nps: float | None) -> str | None:
    if nps is None:
        return None
    if nps >= 50:
        return "Excelente"
    if nps >= 20:
        return "Regular"
    return "Crítico"


def _distribuicao(valores: list[str], total: int, limit: int = 5) -> list[dict]:
    counts = Counter(v for v in valores if v)
    out = []
    for rotulo, qtd in counts.most_common(limit):
        out.append({"rotulo": rotulo, "quantidade": qtd, "pct": round(qtd / total * 100, 1) if total else 0.0})
    return out


def compute_indicadores(db: Session, parque: str | None = None, ano: int | None = None) -> dict:
    ano = ano or date.today().year
    respostas = list_respostas(db, parque=parque, ano=ano)
    ids = [r.id for r in respostas]
    total = len(ids)

    satisfacoes = (
        db.query(DemandaSatisfacao).filter(DemandaSatisfacao.resposta_id.in_(ids)).all() if ids else []
    )
    estadias = (
        db.query(DemandaEstadia).filter(DemandaEstadia.resposta_id.in_(ids)).all() if ids else []
    )
    viagens = (
        db.query(DemandaViagem).filter(DemandaViagem.resposta_id.in_(ids)).all() if ids else []
    )
    perfis = (
        db.query(DemandaPerfilSocioeconomico)
        .filter(DemandaPerfilSocioeconomico.resposta_id.in_(ids))
        .all()
        if ids
        else []
    )

    notas = [s.nps_recomendacao for s in satisfacoes if s.nps_recomendacao is not None]
    nps, prom, neutros, detr = _nps_from(notas)

    pernoites = [e.pernoites for e in estadias if e.pernoites is not None]
    media_pernoites = round(sum(pernoites) / len(pernoites), 1) if pernoites else None

    gasto_by_resp = {p.resposta_id: _parse_money(p.gasto_medio_diario) for p in perfis}
    pernoite_by_resp = {e.resposta_id: e.pernoites for e in estadias}
    tickets = []
    for rid in ids:
        gasto = gasto_by_resp.get(rid)
        noites = pernoite_by_resp.get(rid)
        if gasto is not None and noites:
            tickets.append(gasto * noites)
    ticket_medio = round(sum(tickets) / len(tickets), 2) if tickets else None

    mercados = _distribuicao([e.estado_residencia for e in estadias], total)
    destinos_flat = [d for v in viagens for d in (v.destinos_concorrentes or [])]
    destinos = _distribuicao(destinos_flat, total)

    return {
        "parque": parque,
        "ano": ano,
        "total_respostas": total,
        "nps": nps,
        "nps_label": _nps_label(nps),
        "promotores": prom,
        "neutros": neutros,
        "detratores": detr,
        "media_pernoites": media_pernoites,
        "ticket_medio": ticket_medio,
        "mercados_emissores": mercados,
        "destinos_concorrentes": destinos,
        "serie_nps": _serie_nps(db, parque, meses=12),
    }


def _serie_nps(db: Session, parque: str | None, meses: int = 12) -> list[dict]:
    today = date.today()
    serie = []
    # iterate the last `meses` calendar months, oldest first
    year, month = today.year, today.month
    months = []
    for _ in range(meses):
        months.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    for y, m in reversed(months):
        query = db.query(DemandaSatisfacao.nps_recomendacao).join(
            RespostaDemanda, DemandaSatisfacao.resposta_id == RespostaDemanda.id
        ).filter(
            func.extract("year", RespostaDemanda.coletado_em) == y,
            func.extract("month", RespostaDemanda.coletado_em) == m,
            DemandaSatisfacao.nps_recomendacao.isnot(None),
        )
        if parque:
            query = query.filter(RespostaDemanda.parque == parque)
        notas = [n for (n,) in query.all()]
        nps, *_ = _nps_from(notas)
        serie.append({"mes": f"{MESES_PT[m - 1]}/{str(y)[2:]}", "nps": nps or 0.0, "respostas": len(notas)})
    return serie


# ── Export (US 2.9 — Excel + CSV; PDF deferred) ──────────────────────────────────

EXPORT_HEADERS = [
    "id", "parque", "coletado_em", "pesquisador",
    "estado_residencia", "cidade_residencia", "pernoites", "meio_hospedagem",
    "renda_familiar", "gasto_medio_diario",
    "nps_recomendacao", "nota_destino", "voltaria", "indicaria",
    "alerta_coerencia",
]


def _export_rows(db: Session, parque: str | None, ano: int | None) -> list[list]:
    respostas = list_respostas(db, parque=parque, ano=ano)
    ids = [r.id for r in respostas]
    if not ids:
        return []
    estadias = {e.resposta_id: e for e in db.query(DemandaEstadia).filter(DemandaEstadia.resposta_id.in_(ids))}
    perfis = {p.resposta_id: p for p in db.query(DemandaPerfilSocioeconomico).filter(DemandaPerfilSocioeconomico.resposta_id.in_(ids))}
    satisfacoes = {s.resposta_id: s for s in db.query(DemandaSatisfacao).filter(DemandaSatisfacao.resposta_id.in_(ids))}
    nomes = dict(db.query(Usuario.id, Usuario.nome).all())

    rows = []
    for r in respostas:
        e = estadias.get(r.id)
        p = perfis.get(r.id)
        s = satisfacoes.get(r.id)
        rows.append([
            str(r.id), r.parque, r.coletado_em.isoformat() if r.coletado_em else None,
            nomes.get(r.pesquisador_id),
            e.estado_residencia if e else None, e.cidade_residencia if e else None,
            e.pernoites if e else None, e.meio_hospedagem if e else None,
            p.renda_familiar if p else None, p.gasto_medio_diario if p else None,
            s.nps_recomendacao if s else None, s.nota_destino if s else None,
            s.voltaria if s else None, s.indicaria if s else None,
            r.alerta_coerencia,
        ])
    return rows


def export_csv(db: Session, parque: str | None = None, ano: int | None = None) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_HEADERS)
    writer.writerows(_export_rows(db, parque, ano))
    return buffer.getvalue().encode("utf-8-sig")  # BOM → Excel/Power BI read UTF-8 correctly


def export_xlsx(db: Session, parque: str | None = None, ano: int | None = None) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    ws = wb.active
    ws.title = "Respostas"
    ws.append(EXPORT_HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in _export_rows(db, parque, ano):
        ws.append(row)
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
