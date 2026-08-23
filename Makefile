.PHONY: help dev up down db-bootstrap db-migrate db-migrate-test test test-coverage lint quality test-e2e-mvp1 test-e2e-mvp2-live test-e2e-mvp3-live test-e2e-chat02

.DEFAULT_GOAL := help

PORT_PG := 5435
DB_URL := postgresql://where2play:where2play@localhost:$(PORT_PG)/where2play
TEST_DB_URL := postgresql://where2play:where2play@localhost:$(PORT_PG)/where2play_test

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf " %-18s %s\n", $$1, $$2}'

dev: ## Start Next dev on :3030 (Postgres must be up; run make db-bootstrap once)
	npm run dev

up: ## Ensure Postgres on :5435 is reachable (use what2eat make up, or local Postgres)
	@if command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p $(PORT_PG) >/dev/null 2>&1; then \
		echo "Postgres already ready on :$(PORT_PG)"; \
	elif [ -f ../2.what2eat/Makefile ] && command -v docker >/dev/null 2>&1; then \
		$(MAKE) -C ../2.what2eat up; \
	else \
		echo "Start Postgres on :$(PORT_PG) first (e.g. cd ../2.what2eat && make up)"; \
		exit 1; \
	fi

down: ## Note: shared Postgres is managed by what2eat
	@echo "Shared Postgres on :$(PORT_PG) is managed by what2eat (cd ../2.what2eat && make down if needed)."

db-bootstrap: up ## Create where2play / where2play_test on :5435 (idempotent)
	@chmod +x scripts/db-bootstrap.sh
	@PORT_PG=$(PORT_PG) ./scripts/db-bootstrap.sh

db-migrate: up ## Apply Prisma migrations to where2play
	DATABASE_URL=$(DB_URL) npx prisma migrate deploy

db-migrate-test: db-bootstrap ## Apply migrations to where2play_test
	DATABASE_URL=$(TEST_DB_URL) npx prisma migrate deploy

lint: ## Typecheck
	npm run typecheck

test: db-migrate-test ## Unit/integration tests
	npm test

test-coverage: db-migrate-test ## Unit/integration tests with coverage thresholds
	npm run test:coverage

test-e2e-mvp1: up db-migrate ## MVP-1 Playwright journey
	python3 e2e/run.py mvp1

test-e2e-mvp2-live: up db-migrate ## MVP-2 live Plan + save journey
	python3 e2e/run.py mvp2-live

test-e2e-mvp3-live: up db-migrate ## MVP-3 live Mode H + transit + must-see probe
	PLAN_SLOT_STAGE_MS=0 python3 e2e/run.py mvp3-live

test-e2e-chat02: up db-migrate ## MVP-4 chat-02 local draft (refresh + logout)
	python3 e2e/run.py chat02

quality: lint test-coverage test-e2e-mvp1 ## MVP-1 quality gate
