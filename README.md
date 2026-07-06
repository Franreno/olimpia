# OTO — Sistema de Gestão do Turismo de Olímpia

Sistema web para o Observatório do Turismo de Olímpia (OTO), substituindo o
ecossistema de planilhas eletrônicas usado pela Secretaria de Turismo para
gerenciar o inventário de empresas do trade, pesquisas de demanda turística e
o cálculo da taxa de ocupação hoteleira.

O processo atual é manual, fragmentado entre arquivos Excel e sem
rastreabilidade (sem audit log, com risco de perda de dados e duplicação).
Este sistema entrega três módulos que substituem esse fluxo:

| Módulo | Substitui | Resolve |
|---|---|---|
| **M1 — Inventário Turístico** | `INVENTARIO_OFICIAL_OLIMPIA` + `CONTROLE_PESQUISAS` | Duplicação de dados, ausência de audit log, perda de dados |
| **M2 — Pesquisa de Demanda Turística** | Google Forms + tabulação manual | Erros de grafia de cidades, inconsistências renda/gasto, cálculo manual de NPS |
| **M3 — Taxa de Ocupação Hoteleira** | `TABULACAO_CONSOLIDADAS` + `TABULACAO_EXPECTATIVA` | Fórmula ponderada refeita manualmente todo mês |


**Fora de escopo neste MVP:** Diária Média (Booking.com), integração com bases
externas (CAGED/CIET/ISSQN), dashboard consolidado, gestão de metas do Plano
Diretor, portal externo do trade e integrações via API com fontes externas.

---

## Funcionalidades entregues

Os três módulos do MVP estão implementados e validados de ponta a ponta, com
backend (FastAPI + Postgres) e frontend (Next.js) integrados.

### M1 — Inventário Turístico
- Cadastro de estabelecimentos por categoria, com **campos específicos por categoria**
  (UHs/leitos para meios de hospedagem, capacidade para A&B, etc.) via `campos_extras` JSONB.
- Busca e filtros por nome, categoria e status; paginação da tabela.
- **Audit log append-only** — toda alteração registra autor, data e valores (antigo/novo).
- Encerramento por inativação (`status='inativo'` + `data_baixa`) — empresas nunca são deletadas.
- **Controle de respondentes** — matriz de estabelecimentos × períodos com protocolo e export CSV.
- **Importação da base Excel** legada via CLI idempotente (`python -m app.db.import_inventario`).

### M2 — Pesquisa de Demanda Turística
- Formulário de campo otimizado para tablet, com **autocomplete de cidade** (5.571 municípios IBGE, busca acento-insensível).
- **Alerta de coerência** gasto × renda, configurável via `schema_json`.
- Parque obrigatório; formulário **versionado por ano** e travado durante o ano corrente.
- Dashboard de resultados por parque: **NPS**, ticket médio, média de pernoites, mercados emissores e concorrentes, com gráficos.
- Export para **Excel e CSV** (BOM UTF-8, compatível com Power BI).

### M3 — Taxa de Ocupação Hoteleira
- Criação de períodos **consolidado** ou **expectativa**, com protocolo automático (XXX/AA).
- Herança ao vivo dos meios de hospedagem ativos do inventário.
- **Taxa ponderada por leitos** e **receita estimada** recalculadas automaticamente (síncrono, mesma transação).
- Bloqueio de expectativa em feriado de fim de semana.
- Painel de respondentes (respondeu / pendente / não responde) e export CSV.

> Itens adiados por decisão de escopo do MVP: PWA/offline no formulário de campo,
> export em PDF (aguardando template oficial do OTO), editor visual de schema de formulário
> e comparação histórica de ocupação (ver **Fora de escopo** acima).

![Dashboard de resultados da Pesquisa de Demanda](resultados.png)

---

## Stack tecnológica

### Backend
- **FastAPI** (Python 3.12)
- **SQLAlchemy 2.0** (modelos declarativos `Mapped`/`mapped_column`) + **Alembic** para migrations
- **Pydantic v2** / **pydantic-settings** para schemas, validação e configuração
- **python-jose** + **passlib/bcrypt** para autenticação JWT e hashing de senha
- **Redis** para armazenamento/revogação de refresh tokens
- **PostgreSQL 16** como banco principal
- Recálculo da taxa ponderada é **síncrono** (mesma transação da resposta) neste MVP
- **pytest** com testes contra um banco Postgres real (`oto_test`) — TDD red/green em todos os módulos

### Frontend
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **React Query (TanStack Query)** para data fetching/cache
- **Zod** para validação de formulários
- Formulário de campo (Módulo 2) responsivo, otimizado para toque em tablet
  _(suporte offline/PWA planejado para uma fase seguinte)_

### Infraestrutura
- **Docker Compose** agnóstico de ambiente

### Paleta de cores (do protótipo)

```
--primary:    #1F4E8C   azul escuro — headers, botões primários
--accent:     #2E86AB   azul médio  — links, destaques
--bg-light:   #F5F5F5   cinza claro — fundos de seção
--text-dark:  #1A1A1A   texto principal
--text-gray:  #666666   texto secundário
--success:    #27AE60   ativo, respondido
--warning:    #F39C12   pendente, alerta
--danger:     #E74C3C   inativo, erro
```

---

## Estrutura do repositório

```
.
├── Makefile                   # atalhos para infra, migrations, testes e dev servers
├── database.schema            # schema completo em sintaxe dbdiagram.io
├── docker-compose.yml         # orquestra postgres, redis, backend e frontend
├── DESIGN/                    # protótipo HTML aprovado (fonte de verdade visual)
├── backend/                   # API FastAPI
│   ├── app/
│   │   ├── api/v1/            # routers (auth, inventario, respondente, demanda, ocupacao)
│   │   ├── core/               # config, security (JWT/bcrypt), rbac, redis, logging
│   │   ├── db/                  # Base declarativa, sessão, seed, import_inventario (CLI)
│   │   ├── data/                 # dicionário IBGE de municípios (autocomplete)
│   │   ├── models/                # modelos SQLAlchemy (espelham database.schema)
│   │   ├── schemas/                # schemas Pydantic de request/response
│   │   ├── crud/                    # funções de acesso ao banco (inclui recálculo síncrono da taxa)
│   │   ├── migrations/               # Alembic (env.py + versions/)
│   │   └── main.py                    # app FastAPI, middlewares, registro de routers
│   ├── tests/                 # suíte pytest (espelha a estrutura de app/)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── frontend/                  # Next.js 16 + React 19 (App Router)
    ├── app/
    │   ├── login/               # tela de login
    │   ├── (field)/              # formulário de campo full-screen (M2, sem sidebar)
    │   └── (dashboard)/           # layout autenticado (sidebar, header)
    │       ├── inventario/         # M1: lista, detalhe, novo, editar, respondentes
    │       ├── demanda/             # M2: dashboard, parques, versões, coletas
    │       └── ocupacao/             # M3: lista de períodos, detalhe do período
    ├── components/              # componentes shadcn/ui + app-sidebar, auth-guard
    ├── lib/                      # api client, auth context, react-query hooks, types
    └── Dockerfile
```

---

## Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose
- [Conda/Miniconda](https://docs.conda.io/) (ambiente Python do backend)
- Node.js 20+ (para rodar o frontend fora do container)

---

## Comandos rápidos (Makefile)

O `Makefile` na raiz do projeto cobre o fluxo de desenvolvimento do dia a dia.
Liste todos os alvos com:

```bash
make help
```

| Categoria | Alvos | Descrição |
|---|---|---|
| Infra | `up`, `up-all`, `down`, `restart`, `logs`, `ps` | `up` sobe só `db`+`redis`; `up-all` sobe tudo containerizado |
| Banco de dados | `migrate`, `migrate-new m="..."`, `seed`, `db-reset` | Alembic + seed idempotente |
| Backend | `dev-be`, `test`, `test-file f=...`, `install-be` | servidor com reload, suíte pytest, dependências |
| Frontend | `dev-fe`, `build-fe`, `lint-fe`, `install-fe` | Next.js dev/build/lint/instalação |
| Composto | `setup`, `dev` | `setup` faz o primeiro provisionamento completo; `dev` sobe infra + backend + frontend juntos |

Primeira vez no projeto:

```bash
make setup   # infra up, migrate, seed, install-fe
make dev     # backend (uvicorn --reload) + frontend (npm run dev)
```

Os passos manuais equivalentes (sem Makefile) estão descritos abaixo.

---

## Como rodar

### 1. Subir a infraestrutura (Postgres + Redis + API)

```bash
cp backend/.env.example backend/.env   # ajuste os valores conforme necessário
docker compose up -d
# equivalente: make up (apenas db+redis) ou make up-all (tudo containerizado)
```

A API ficará disponível em `http://localhost:8000` (com reload automático),
Postgres em `localhost:5432` (usuário/senha/banco `oto`, com um banco extra
`oto_test` criado automaticamente para a suíte de testes) e Redis em
`localhost:6379`.

### 2. Ambiente de desenvolvimento do backend (fora do container)

O projeto usa **conda**, não venv:

```bash
conda create -y -n oto -c conda-forge python=3.12
conda activate oto
cd backend
python -m pip install -r requirements.txt
# equivalente: make install-be
```

Aplique as migrations e popule os dados iniciais (categorias de empresa + um
usuário de teste por perfil):

```bash
alembic upgrade head
python -m app.db.seed
# equivalente: make migrate seed
```

Suba a API localmente (alternativa ao container):

```bash
uvicorn app.main:app --reload
# equivalente: make dev-be
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# equivalente: make install-fe dev-fe
```

Disponível em `http://localhost:3000`.

---

## Rodando os testes (backend)

A suíte segue **TDD** (red → green) e roda contra um banco Postgres real
(`oto_test`, criado pelo `docker-compose.yml`), pois tipos como `JSONB`,
`UUID`, `ARRAY` e `CHECK constraints` não podem ser fielmente emulados em
SQLite. Cada teste roda isolado em uma transação com rollback (padrão
SAVEPOINT) e o Redis de teste usa um banco lógico dedicado (DB 15).

```bash
cd backend
conda run -n oto python -m pytest -q
# equivalente: make test (ou make test-file f=tests/api/test_auth.py)
```

---

## Autenticação e perfis de acesso

Autenticação via **JWT**: access token (15 min, retornado no corpo da
resposta) + refresh token (7 dias, cookie `httpOnly`, espelhado no Redis para
permitir revogação no logout).

| Endpoint | Descrição |
|---|---|
| `POST /api/v1/auth/login` | Autentica e retorna `access_token` + cookie de refresh |
| `POST /api/v1/auth/refresh` | Emite novo `access_token` a partir do cookie de refresh válido |
| `POST /api/v1/auth/logout` | Revoga o refresh token (Redis) e limpa o cookie |
| `GET /api/v1/auth/me` | Retorna os dados do usuário autenticado |

Quatro perfis controlam o acesso via dependências `get_current_user` /
`require_role(*perfis)`:

| Perfil | Permissões |
|---|---|
| `admin` | Acesso total |
| `editor` | CRUD de empresas e pesquisas |
| `pesquisador` | Apenas submissão de respostas de demanda (Módulo 2) |
| `gestor` | Apenas leitura (`GET`) e exportação |

---

## Regras de negócio críticas

Estas regras são impostas pela implementação e **nunca** podem ser violadas:

1. **Empresas nunca são deletadas** — encerramentos usam `status = 'inativo'` + `data_baixa`.
2. **Audit log é append-only** — toda alteração em `empresa` gera um registro; nunca há `UPDATE`/`DELETE` em `audit_log` (retenção mínima de 5 anos).
3. **Formulário de demanda trava em janeiro** — `formulario_versao` com `status = 'travado'` não pode ter o schema editado; novas versões só com `ano = ano_atual + 1`.
4. **Parque é obrigatório** em `resposta_demanda` — todos os indicadores (NPS, ticket médio, pernoites) são calculáveis por parque.
5. **Peso ponderado deriva dos leitos** — alterações em `empresa.campos_extras->>'leitos'` disparam recálculo do `resultado_ocupacao` do período corrente.
6. **Feriados em sábado/domingo não geram pesquisa de expectativa** — bloqueado na criação do período com mensagem clara.
7. **NPS** = `% Promotores (nota 9–10) − % Detratores (nota 0–6)`
8. **Receita estimada** = `total_leitos_inventario × (taxa_ponderada / 100) × diária_média_ponderada × qtd_diárias_período`

---