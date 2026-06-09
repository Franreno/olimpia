# User Stories — Tracking

Tracks the user stories from `CLAUDE.md` §6 against implementation progress.
Status values: `not started` · `in progress` · `done` · `verified` (manually smoke-tested end-to-end).

Sprint mapping follows `CLAUDE.md` §9. This file is updated as each sprint lands.

---

## Sprint 1 — Backend Foundation (auth + M1 CRUD + audit log)

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 1.1 | Cadastrar empresas por categoria | Obrigatório | **verified** | `POST /empresas`, `GET /categorias` — smoke-tested 2026-06-09 |
| 1.3 | Toda alteração registrada em audit log (autor, data, valores) | Obrigatório | **verified** | `record_audit` helper — INSERT snapshot + per-field UPDATE rows — smoke-tested |
| 1.4 | Empresas encerradas marcadas inativas, nunca deletadas | Obrigatório | **verified** | `DELETE /empresas/{id}` → sets `status=inativo` + `data_baixa` — smoke-tested |
| 1.5 | Buscar/filtrar empresas por categoria, status, nome | Obrigatório | **verified** | `GET /empresas?categoria_id=&status=&q=` — 18 API tests passing |
| 5.3 | Perfis: Administrador, Editor, Pesquisador, Gestor | Obrigatório | **verified** | RBAC via `require_role` — 403 confirmed for gestor/pesquisador on write endpoints |
| 5.9 | Audit log retido por pelo menos 5 anos | Obrigatório | **done** | append-only `audit_log` table — no DELETE/UPDATE paths exist; retention enforced by policy |

---

## Module 1 — Inventário (remaining, later sprints)

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 1.2 | Campos específicos por categoria (UHs/leitos, capacidade, etc.) | Obrigatório | not started | `empresa.campos_extras` JSONB — UI in Sprint 2 |
| 1.6 | Alterar leitos recalcula peso ponderado | Obrigatório | not started | depends on M3 Celery worker (Sprint 4) |
| 1.7 | Registrar quais estabelecimentos participam de cada pesquisa | Obrigatório | not started | `respondente_pesquisa` |
| 1.8 | Numeração protocolar automática (XXX/AA) | Importante | not started | |
| 1.9 | Importar base Excel existente na migração inicial | Obrigatório | not started | seed/import script — partial pattern established via seed.py |

## Module 2 — Pesquisa de Demanda Turística (Sprint 3)

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 2.1 | Formulário offline no tablet, sync ao reconectar | Obrigatório | not started | PWA + IndexedDB |
| 2.2 | Autocomplete de cidade (dicionário IBGE) | Obrigatório | not started | |
| 2.3 | Alerta gasto incompatível com renda | Obrigatório | not started | `formulario_versao.schema_json.regras_coerencia` |
| 2.4 | Seleção obrigatória de parque | Obrigatório | not started | `resposta_demanda.parque NOT NULL` |
| 2.5 | Formulário versionado por ano e travado | Obrigatório | not started | `formulario_versao.status` |
| 2.6 | NPS calculado automaticamente | Obrigatório | not started | `(%promotores - %detratores)` |
| 2.7 | Pernoites médios, ticket médio, mercados emissores automáticos | Obrigatório | not started | |
| 2.8 | Visualizar resultados por período/parque com gráficos | Obrigatório | not started | |
| 2.9 | Exportar resultados em Excel e PDF | Obrigatório | not started | |

## Module 3 — Taxa de Ocupação Hoteleira (Sprint 4)

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 3.1 | Criar períodos consolidado ou expectativa | Obrigatório | not started | |
| 3.2 | Novo período herda estabelecimentos ativos do inventário | Obrigatório | not started | |
| 3.3 | Alerta ao criar expectativa em feriado de fim de semana | Importante | not started | |
| 3.4 | Taxa ponderada calculada automaticamente por leitos | Obrigatório | not started | Celery `recalcular_resultado` |
| 3.5 | Receita turística estimada calculada automaticamente | Obrigatório | not started | |
| 3.6 | Ver quem respondeu / pendente / nunca responde | Obrigatório | not started | |
| 3.7 | Comparar taxa de ocupação com períodos de anos anteriores | Importante | not started | |

## Cross-cutting / validation findings

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 4.1 | Relatórios com template fixo para publicação | Importante | not started | PDF lib TBD (WeasyPrint vs jsPDF — open point §10) |
| 4.2 | Fluxo de turistas calculado cruzando M1+M2+M3 | Importante | not started | |

## Requisitos Não Funcionais

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 5.1 | Acesso via browser, sem instalação | Obrigatório | **done** | Next.js 16 + shadcn frontend — builds cleanly, routes /login /inventario /inventario/[id] /inventario/novo |
| 5.2 | Formulário otimizado para toque em tablet | Obrigatório | not started | Sprint 3 |
| 5.4 | Backup automático diário, rollback de 30 dias | Obrigatório | not started | infra-level — TBD with TI da Prefeitura |
| 5.5 | Criar novos tipos de pesquisa sem developer | Obrigatório | not started | config-driven `formulario_versao.schema_json` |
| 5.6 | Formulário offline com sync ao reconectar | Obrigatório | not started | duplicate of 2.1 |
| 5.7 | Sistema agnóstico de infra (cloud ou on-premise) | Obrigatório | **done** | Docker Compose with postgres:16-alpine + redis:7 — same compose works cloud or on-premise |
| 5.8 | Export compatível com Power BI | Importante | not started | |

---

## Open points (CLAUDE.md §10 — do not block Sprint 1 on these)
- Cloud vs. on-premise (affects deploy stack — Docker Compose chosen to stay agnostic)
- Templates de relatório (4.1) — PDF engine choice pending OTO templates
- Formato do export Power BI (5.8)
- Perfis de acesso detalhados (5.3) — confirm exact permission matrix per perfil with client
