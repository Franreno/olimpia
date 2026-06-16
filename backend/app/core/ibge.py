"""IBGE municipalities dictionary for city autocomplete (US 2.2).

The bundled JSON at ``app/data/ibge_municipios.json`` is the complete list of
~5.570 Brazilian municipalities fetched from the IBGE localidades API. It can be
regenerated with ``python -m app.db.seed --refresh-ibge`` (see seed.py).
"""

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "ibge_municipios.json"


def _strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


@lru_cache(maxsize=1)
def _municipios() -> list[dict]:
    with _DATA_FILE.open(encoding="utf-8") as fh:
        data = json.load(fh)
    # precompute a normalized search key once
    for m in data:
        m["_key"] = _strip_accents(m["nome"]).lower()
    return data


def search_cidades(q: str, limit: int = 8) -> list[dict]:
    """Accent-insensitive prefix-then-substring search over municipalities."""
    if not q or len(q.strip()) < 2:
        return []
    needle = _strip_accents(q.strip()).lower()
    municipios = _municipios()

    prefix = [m for m in municipios if m["_key"].startswith(needle)]
    if len(prefix) < limit:
        seen = {(m["nome"], m["uf"]) for m in prefix}
        contains = [
            m for m in municipios if needle in m["_key"] and (m["nome"], m["uf"]) not in seen
        ]
        results = prefix + contains
    else:
        results = prefix

    return [{"nome": m["nome"], "uf": m["uf"]} for m in results[:limit]]
