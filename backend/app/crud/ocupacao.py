import uuid
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.inventario import CategoriaEmpresa, Empresa
from app.models.ocupacao import PeriodoOcupacao, RespostaOcupacao, ResultadoOcupacao
from app.schemas.ocupacao import PeriodoCreate, RespostaOcupacaoCreate

HOSPEDAGEM_SLUG = "meios_hospedagem"
STATUS_ABERTO = "aberto"

# Statuses used in the period roster (matches the prototype's badges).
ST_RESPONDEU = "respondeu"
ST_PENDENTE = "pendente"
ST_NAO_RESPONDE = "nao_responde"


# ── helpers ───────────────────────────────────────────────────────────────────────


def _to_int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _leitos_of(empresa: Empresa) -> int:
    return _to_int((empresa.campos_extras or {}).get("leitos")) or 0


def _uhs_of(empresa: Empresa) -> int | None:
    return _to_int((empresa.campos_extras or {}).get("uhs"))


def _q2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def active_hospedagem_empresas(db: Session) -> list[Empresa]:
    """The live roster: active lodging establishments inherited from the inventory (US 3.2)."""
    return (
        db.query(Empresa)
        .join(CategoriaEmpresa, Empresa.categoria_id == CategoriaEmpresa.id)
        .filter(CategoriaEmpresa.slug == HOSPEDAGEM_SLUG, Empresa.status == "ativo")
        .order_by(Empresa.nome_fantasia)
        .all()
    )


def qtd_diarias(periodo: PeriodoOcupacao) -> int:
    """Inclusive number of nights in the period (minimum 1)."""
    return max((periodo.data_fim - periodo.data_inicio).days + 1, 1)


def is_weekend_expectativa(tipo: str, data_inicio: date, data_fim: date) -> bool:
    """US 3.3 / §8.6 — Saturday/Sunday do not generate 'expectativa' surveys."""
    return tipo == "expectativa" and (data_inicio.weekday() >= 5 or data_fim.weekday() >= 5)


def gerar_protocolo(db: Session, ano: int | None = None) -> str:
    """Sequential per-year protocol in the XXX/AA format (US 1.8)."""
    ano = ano or date.today().year
    yy = ano % 100
    sufixo = f"/{yy:02d}"
    existentes = (
        db.query(PeriodoOcupacao).filter(PeriodoOcupacao.protocolo.like(f"%{sufixo}")).count()
    )
    return f"{existentes + 1:03d}{sufixo}"


# ── Períodos ───────────────────────────────────────────────────────────────────────


def create_periodo(db: Session, data: PeriodoCreate, usuario_id: uuid.UUID) -> PeriodoOcupacao:
    if is_weekend_expectativa(data.tipo, data.data_inicio, data.data_fim):
        raise ValueError(
            "Períodos de expectativa não podem cair em sábado ou domingo. "
            "Feriados prolongados em dias de semana devem ser cadastrados manualmente."
        )

    periodo = PeriodoOcupacao(
        tipo=data.tipo,
        descricao=data.descricao,
        data_inicio=data.data_inicio,
        data_fim=data.data_fim,
        status=STATUS_ABERTO,
        protocolo=gerar_protocolo(db),
        criado_por=usuario_id,
    )
    db.add(periodo)
    db.commit()
    db.refresh(periodo)
    # initialise an (empty) resultado row so the dashboard has something to read
    recalcular_resultado(db, periodo.id)
    return periodo


def get_periodo(db: Session, periodo_id: int) -> PeriodoOcupacao | None:
    return db.get(PeriodoOcupacao, periodo_id)


def _periodo_out_fields(db: Session, periodo: PeriodoOcupacao, total_estab: int | None = None) -> PeriodoOcupacao:
    """Attach derived fields (progress + weighted result) onto the ORM object for serialisation."""
    if total_estab is None:
        total_estab = len(active_hospedagem_empresas(db))
    respondidos = (
        db.query(RespostaOcupacao)
        .filter(
            RespostaOcupacao.periodo_id == periodo.id,
            RespostaOcupacao.taxa_ocupacao.isnot(None),
        )
        .count()
    )
    resultado = db.query(ResultadoOcupacao).filter(ResultadoOcupacao.periodo_id == periodo.id).first()
    periodo.total_estabelecimentos = total_estab
    periodo.total_respondentes = respondidos
    periodo.taxa_ponderada = resultado.taxa_ponderada if resultado else None
    periodo.receita_estimada = resultado.receita_estimada if resultado else None
    return periodo


def list_periodos(db: Session) -> list[PeriodoOcupacao]:
    periodos = db.query(PeriodoOcupacao).order_by(PeriodoOcupacao.data_inicio.desc(), PeriodoOcupacao.id.desc()).all()
    total_estab = len(active_hospedagem_empresas(db))
    return [_periodo_out_fields(db, p, total_estab) for p in periodos]


def get_periodo_out(db: Session, periodo_id: int) -> PeriodoOcupacao | None:
    periodo = get_periodo(db, periodo_id)
    if periodo is None:
        return None
    return _periodo_out_fields(db, periodo)


# ── Roster / estabelecimentos do período ───────────────────────────────────────────


def estabelecimentos_do_periodo(db: Session, periodo: PeriodoOcupacao) -> list[dict]:
    empresas = active_hospedagem_empresas(db)
    respostas = {
        r.empresa_id: r
        for r in db.query(RespostaOcupacao).filter(RespostaOcupacao.periodo_id == periodo.id).all()
    }
    total_leitos = sum(_leitos_of(e) for e in empresas) or 0
    diarias = qtd_diarias(periodo)

    out = []
    for e in empresas:
        leitos = _leitos_of(e)
        resposta = respostas.get(e.id)
        respondeu = resposta is not None and resposta.taxa_ocupacao is not None

        if respondeu:
            status = ST_RESPONDEU
        elif not e.aceita_pesquisas:
            status = ST_NAO_RESPONDE
        else:
            status = ST_PENDENTE

        receita = None
        if respondeu and resposta.diaria_media is not None:
            receita = _q2(
                Decimal(leitos)
                * (resposta.taxa_ocupacao / Decimal(100))
                * resposta.diaria_media
                * Decimal(diarias)
            )

        out.append(
            {
                "empresa_id": e.id,
                "nome_fantasia": e.nome_fantasia,
                "uhs": _uhs_of(e),
                "leitos": leitos,
                "peso": round(leitos / total_leitos * 100, 2) if total_leitos else 0.0,
                "status": status,
                "taxa_ocupacao": resposta.taxa_ocupacao if resposta else None,
                "diaria_media": resposta.diaria_media if resposta else None,
                "receita_estimada": receita,
                "respondido_em": resposta.respondido_em if resposta else None,
                "observacao": resposta.observacao if resposta else None,
            }
        )
    return out


# ── Respostas (entrada manual + recálculo síncrono) ─────────────────────────────────


def upsert_resposta(
    db: Session, periodo: PeriodoOcupacao, data: RespostaOcupacaoCreate, usuario_id: uuid.UUID
) -> RespostaOcupacao:
    empresa = db.get(Empresa, data.empresa_id)
    if empresa is None:
        raise ValueError("Estabelecimento não encontrado.")

    resposta = (
        db.query(RespostaOcupacao)
        .filter(RespostaOcupacao.periodo_id == periodo.id, RespostaOcupacao.empresa_id == data.empresa_id)
        .first()
    )
    if resposta is None:
        resposta = RespostaOcupacao(periodo_id=periodo.id, empresa_id=data.empresa_id)
        db.add(resposta)

    resposta.taxa_ocupacao = data.taxa_ocupacao
    resposta.diaria_media = data.diaria_media
    resposta.uhs_informadas = data.uhs_informadas if data.uhs_informadas is not None else _uhs_of(empresa)
    resposta.leitos_informados = (
        data.leitos_informados if data.leitos_informados is not None else _leitos_of(empresa)
    )
    resposta.observacao = data.observacao
    resposta.respondido_em = datetime.utcnow()
    resposta.respondido_por = usuario_id

    db.commit()
    recalcular_resultado(db, periodo.id)  # synchronous — same request, no Celery
    db.refresh(resposta)
    return resposta


def recalcular_resultado(db: Session, periodo_id: int) -> ResultadoOcupacao:
    """Recompute the weighted occupancy + estimated revenue for a period (§8.5, §8.8)."""
    periodo = db.get(PeriodoOcupacao, periodo_id)
    empresas = {e.id: e for e in active_hospedagem_empresas(db)}
    total_leitos_inventario = sum(_leitos_of(e) for e in empresas.values())

    respostas = (
        db.query(RespostaOcupacao)
        .filter(RespostaOcupacao.periodo_id == periodo_id, RespostaOcupacao.taxa_ocupacao.isnot(None))
        .all()
    )

    soma_taxa_leitos = Decimal(0)
    soma_leitos = 0
    soma_diaria_leitos = Decimal(0)
    soma_leitos_com_diaria = 0
    for r in respostas:
        # §8.5 — the weight derives from the inventory bed count so editing leitos
        # re-derives the weighted rate. Fall back to the reported value only if the
        # establishment is no longer in the active roster.
        empresa = empresas.get(r.empresa_id)
        if empresa is not None:
            leitos = _leitos_of(empresa)
        else:
            leitos = r.leitos_informados or 0
        if not leitos:
            continue
        soma_taxa_leitos += r.taxa_ocupacao * Decimal(leitos)
        soma_leitos += leitos
        if r.diaria_media is not None:
            soma_diaria_leitos += r.diaria_media * Decimal(leitos)
            soma_leitos_com_diaria += leitos

    taxa_ponderada = _q2(soma_taxa_leitos / Decimal(soma_leitos)) if soma_leitos else None
    diaria_ponderada = _q2(soma_diaria_leitos / Decimal(soma_leitos_com_diaria)) if soma_leitos_com_diaria else None
    perc_leitos = (
        _q2(Decimal(soma_leitos) / Decimal(total_leitos_inventario) * Decimal(100))
        if total_leitos_inventario
        else None
    )

    receita = None
    if taxa_ponderada is not None and diaria_ponderada is not None and total_leitos_inventario:
        receita = _q2(
            Decimal(total_leitos_inventario)
            * (taxa_ponderada / Decimal(100))
            * diaria_ponderada
            * Decimal(qtd_diarias(periodo))
        )

    resultado = db.query(ResultadoOcupacao).filter(ResultadoOcupacao.periodo_id == periodo_id).first()
    if resultado is None:
        resultado = ResultadoOcupacao(periodo_id=periodo_id)
        db.add(resultado)

    resultado.taxa_ponderada = taxa_ponderada
    resultado.total_respondentes = len(respostas)
    resultado.total_leitos_respondidos = soma_leitos
    resultado.perc_leitos_respondidos = perc_leitos
    resultado.diaria_media_ponderada = diaria_ponderada
    resultado.receita_estimada = receita
    resultado.calculado_em = datetime.utcnow()

    db.commit()
    db.refresh(resultado)
    return resultado


def get_resultado(db: Session, periodo: PeriodoOcupacao) -> dict:
    resultado = db.query(ResultadoOcupacao).filter(ResultadoOcupacao.periodo_id == periodo.id).first()
    total_leitos_inventario = sum(_leitos_of(e) for e in active_hospedagem_empresas(db))
    return {
        "periodo_id": periodo.id,
        "taxa_ponderada": resultado.taxa_ponderada if resultado else None,
        "total_respondentes": resultado.total_respondentes if resultado else 0,
        "total_leitos_respondidos": resultado.total_leitos_respondidos if resultado else 0,
        "perc_leitos_respondidos": resultado.perc_leitos_respondidos if resultado else None,
        "diaria_media_ponderada": resultado.diaria_media_ponderada if resultado else None,
        "receita_estimada": resultado.receita_estimada if resultado else None,
        "total_leitos_inventario": total_leitos_inventario,
        "qtd_diarias": qtd_diarias(periodo),
        "calculado_em": resultado.calculado_em if resultado else None,
    }


def recalcular_periodos_abertos(db: Session) -> None:
    """When inventory beds change, refresh the weighted result of every open period (§8.5)."""
    abertos = db.query(PeriodoOcupacao.id).filter(PeriodoOcupacao.status == STATUS_ABERTO).all()
    for (periodo_id,) in abertos:
        recalcular_resultado(db, periodo_id)
