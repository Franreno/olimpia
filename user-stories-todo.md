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

## Sprint 2 — Frontend M1 (Inventário)

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 1.1 | Cadastrar empresas por categoria | Obrigatório | **verified** | `/inventario/novo` — formulário completo (Identificação, Classificação, Contato para pesquisas) — smoke-tested end-to-end (form → `POST /empresas` → detalhe) |
| 1.2 | Campos específicos por categoria (UHs e leitos para MH, capacidade para A&B) | Obrigatório | **in progress** | Implementado para Meios de Hospedagem (tipo, UHs, leitos) em `novo`/`editar`/detalhe ("Dados de Hospedagem"); demais categorias (alimentação, atrativos, agências, eventos, serviços de apoio) ainda sem campos específicos na UI |
| 1.3 | Toda alteração registrada em audit log com autor, data e valores | Obrigatório | **verified** | `/inventario/[id]` aba "Histórico de alterações" — diff por campo (PT-BR labels), avatar com iniciais, valores antigo/novo destacados, paginação ("Mostrar mais") |
| 1.4 | Empresas encerradas marcadas como inativas (nunca deletar) | Obrigatório | **verified** | Botão "Inativar" no detalhe (com confirmação) → `DELETE /empresas/{id}` → `status=inativo` + badge cinza na lista |
| 1.5 | Buscar e filtrar empresas por categoria, status e nome | Obrigatório | **verified** | `/inventario` — busca por nome + chips de categoria/status, contagem de resultados |
| — | Lista do inventário fiel ao protótipo (badges de status, botões Ver/Editar com ícone) | — | **verified** | Badge verde "Ativo" / cinza "Inativo"; ações "Ver"/"Editar" com `variant=outline` + ícones `Eye`/`Pencil` |

**Pendente do escopo do Sprint 2** (CLAUDE.md §9, item 9 — "painel de respondentes de pesquisa"): ver 1.7 abaixo.

---

## Module 1 — Inventário (remaining, later sprints)

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 1.6 | Alterar leitos recalcula peso ponderado | Obrigatório | not started | Sprint 4 (M3). Recálculo **síncrono** na mesma transação da escrita — sem Celery (agregado simples `SUM(taxa*leitos)/SUM(leitos)` sobre as respostas do período) |
| 1.7 | Registrar quais estabelecimentos participam de cada pesquisa | Obrigatório | not started | `respondente_pesquisa` model exists (Sprint 1 migration) — sem CRUD/API nem painel de respondentes na UI |
| 1.8 | Numeração protocolar automática (XXX/AA) | Importante | not started | |
| 1.9 | Importar base Excel existente na migração inicial | Obrigatório | not started | seed/import script — partial pattern established via seed.py |

## Module 2 — Pesquisa de Demanda Turística (Sprint 3)

> **Decisão (2026-06-16):** este passo entrega o M2 **sem PWA/offline**. O formulário de campo
> submete online. 2.1 fica adiado (não cancelado). Export: Excel + CSV agora, PDF adiado até o
> template oficial do OTO (CLAUDE.md §10). Autocomplete de cidade usa lista completa do IBGE
> (~5.570 municípios) buscada no seed e servida por endpoint do backend.

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 2.1 | Formulário offline no tablet, sync ao reconectar | Obrigatório | **deferred** | PWA + IndexedDB — adiado por decisão de 2026-06-16; formulário online entregue primeiro |
| 2.2 | Autocomplete de cidade (dicionário IBGE) | Obrigatório | **verified** | 5.571 municípios IBGE em `app/data/ibge_municipios.json` (regen via `python -m app.db.seed --refresh-ibge`); `GET /demanda/cidades?q=` busca acento-insensível (prefixo→substring); UI no formulário de campo — smoke-tested |
| 2.3 | Alerta gasto incompatível com renda | Obrigatório | **verified** | config-driven `schema_json.regras_coerencia` (`tipo=gasto_vs_renda`, `fator`); backend grava `alerta_coerencia`+`descricao_alerta`; UI mostra aviso ao vivo — smoke-tested |
| 2.4 | Seleção obrigatória de parque | Obrigatório | **verified** | `parque NOT NULL` + CHECK; 422 sem parque; seletor obrigatório na UI — smoke-tested |
| 2.5 | Formulário versionado por ano e travado | Obrigatório | **done** | `GET/POST /demanda/formularios`; nova versão só `ano_atual+1`; tela "Versões do formulário" (ativo/bloqueado). Pendente UI: "Ver formulário" e "Preparar versão 2027" |
| 2.6 | NPS calculado automaticamente | Obrigatório | **verified** | `(%prom 9-10 - %detr 0-6)*100`; por parque; série mensal 12m — smoke-tested |
| 2.7 | Pernoites médios, ticket médio, mercados emissores automáticos | Obrigatório | **verified** | `GET /demanda/indicadores` — média pernoites, ticket (gasto×pernoites), top estados emissores, top destinos concorrentes — smoke-tested |
| 2.8 | Visualizar resultados por período/parque com gráficos | Obrigatório | **verified** | `/demanda` — abas por parque, stat cards, gráfico SVG de evolução do NPS, barras de mercados, cards de concorrentes — smoke-tested |
| 2.9 | Exportar resultados em Excel e PDF | Obrigatório | **done (PDF adiado)** | `GET /demanda/export?formato=xlsx\|csv` (openpyxl + CSV com BOM p/ Power BI); botões Excel/CSV na UI. **PDF adiado** até template do OTO (CLAUDE.md §10) |

## Module 3 — Taxa de Ocupação Hoteleira (Sprint 4)

| ID | História | Prioridade | Status | Notes |
|---|---|---|---|---|
| 3.1 | Criar períodos consolidado ou expectativa | Obrigatório | not started | |
| 3.2 | Novo período herda estabelecimentos ativos do inventário | Obrigatório | not started | |
| 3.3 | Alerta ao criar expectativa em feriado de fim de semana | Importante | not started | |
| 3.4 | Taxa ponderada calculada automaticamente por leitos | Obrigatório | not started | Recálculo **síncrono** na criação/edição de `resposta_ocupacao` (sem Celery) |
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
| 5.1 | Acesso via browser, sem instalação | Obrigatório | **done** | Next.js 16 + shadcn frontend — builds cleanly, routes /login /inventario /inventario/[id] /inventario/[id]/editar /inventario/novo |
| 5.2 | Formulário otimizado para toque em tablet | Obrigatório | **done** | Formulário de campo full-screen em grupo de rota `(field)` (sem sidebar), alvos de toque grandes, layout responsivo |
| 5.5 | Criar novos tipos de pesquisa sem developer | Obrigatório | **partial** | `formulario_versao.schema_json` define campos+regras; backend versiona/trava e usa as regras de coerência. Pendente: editor visual de schema na UI (hoje a versão do próximo ano é criada via API) |
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
