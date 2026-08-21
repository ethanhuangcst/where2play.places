#!/usr/bin/env bash
# Create where2play + where2play_test on family Postgres :5435 (ADR-033). Idempotent.
set -euo pipefail
PORT="${PORT_PG:-5435}"
URLS=(
  "postgresql://what2eat:what2eat@localhost:${PORT}/postgres"
  "postgresql://postgres:postgres@localhost:${PORT}/postgres"
)

run_sql() {
  local url="$1"
  psql "$url" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'where2play') THEN
    CREATE ROLE where2play LOGIN PASSWORD 'where2play';
  END IF;
END
$$;
SQL
  psql "$url" -tc "SELECT 1 FROM pg_database WHERE datname = 'where2play'" | grep -q 1 \
    || psql "$url" -c "CREATE DATABASE where2play OWNER where2play;"
  psql "$url" -tc "SELECT 1 FROM pg_database WHERE datname = 'where2play_test'" | grep -q 1 \
    || psql "$url" -c "CREATE DATABASE where2play_test OWNER where2play;"
}

ok=0
for u in "${URLS[@]}"; do
  if psql "$u" -c "SELECT 1" >/dev/null 2>&1; then
    run_sql "$u"
    ok=1
    break
  fi
done

if [[ "$ok" -ne 1 ]]; then
  echo "Could not connect to Postgres on :${PORT}. Start it first (e.g. cd ../2.what2eat && make up)." >&2
  exit 1
fi

echo "DBs ready: where2play, where2play_test on :${PORT}"
