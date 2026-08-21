.PHONY: help dev up down db-bootstrap

.DEFAULT_GOAL := help

PORT_PG := 5435

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf " %-14s %s\n", $$1, $$2}'

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
