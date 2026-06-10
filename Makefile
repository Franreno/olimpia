CONDA_ENV := oto
BE := backend
FE := frontend

CONDA_RUN := conda run -n $(CONDA_ENV) --no-capture-output

.DEFAULT_GOAL := help

# ─── Infrastructure ──────────────────────────────────────────────────────────

.PHONY: up down restart logs ps

up: ## Start Postgres + Redis (local dev, no containerised backend)
	docker compose up -d db redis

up-all: ## Start all services: db, redis, backend, frontend (fully containerised)
	docker compose up -d

down: ## Stop and remove containers (keep volumes)
	docker compose down

restart: down up ## Restart Postgres + Redis

logs: ## Follow docker compose logs (Ctrl-C to exit)
	docker compose logs -f

ps: ## Show running containers
	docker compose ps

# ─── Database ────────────────────────────────────────────────────────────────

.PHONY: migrate migrate-new seed db-reset

migrate: ## Apply all pending Alembic migrations
	cd $(BE) && $(CONDA_RUN) alembic upgrade head

migrate-new: ## Generate a new migration (usage: make migrate-new m="short description")
	cd $(BE) && $(CONDA_RUN) alembic revision --autogenerate -m "$(m)"

seed: ## Seed dev data (idempotent — categories + one user per perfil)
	cd $(BE) && $(CONDA_RUN) python -m app.db.seed

db-reset: ## Drop + recreate schema, migrate, and seed (destroys all local data)
	cd $(BE) && $(CONDA_RUN) alembic downgrade base
	cd $(BE) && $(CONDA_RUN) alembic upgrade head
	cd $(BE) && $(CONDA_RUN) python -m app.db.seed

# ─── Backend ─────────────────────────────────────────────────────────────────

.PHONY: dev-be test test-file install-be

dev-be: ## Run backend dev server with hot reload (requires db + redis running)
	cd $(BE) && $(CONDA_RUN) uvicorn app.main:app --reload

test: ## Run full backend test suite
	cd $(BE) && $(CONDA_RUN) python -m pytest -q

test-file: ## Run a specific test file (usage: make test-file f=tests/api/test_auth.py)
	cd $(BE) && $(CONDA_RUN) python -m pytest $(f) -q

test-watch: ## Re-run tests on file change (requires pytest-watch)
	cd $(BE) && $(CONDA_RUN) python -m pytest -q --tb=short -x

install-be: ## Install/update backend Python dependencies
	conda run -n $(CONDA_ENV) pip install -r $(BE)/requirements.txt

# ─── Frontend ────────────────────────────────────────────────────────────────

.PHONY: dev-fe build-fe lint-fe install-fe

dev-fe: ## Run Next.js dev server on http://localhost:3000
	cd $(FE) && npm run dev

build-fe: ## Build frontend for production
	cd $(FE) && npm run build

lint-fe: ## Run ESLint on frontend
	cd $(FE) && npm run lint

install-fe: ## Install/update frontend npm dependencies
	cd $(FE) && npm install

# ─── Compound ────────────────────────────────────────────────────────────────

.PHONY: dev setup

dev: up ## Start infra and run backend + frontend dev servers in parallel
	@echo "Starting backend and frontend dev servers..."
	@$(CONDA_RUN) bash -c "cd $(BE) && uvicorn app.main:app --reload" & \
	cd $(FE) && npm run dev

setup: up migrate seed install-fe ## First-time setup: infra up, migrate, seed, install frontend deps
	@echo ""
	@echo "Setup complete. Run 'make dev' to start all dev servers."

# ─── Help ────────────────────────────────────────────────────────────────────

.PHONY: help

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	  /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
