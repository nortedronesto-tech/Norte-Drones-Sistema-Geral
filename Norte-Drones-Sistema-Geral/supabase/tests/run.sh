#!/usr/bin/env bash
# Testa as migrations e a regra de rateio em um Postgres local (sem precisar do Supabase).
# Uso:  PGHOST=localhost PGUSER=postgres bash supabase/tests/run.sh
# Requer um Postgres 15+ acessível via psql. Cria e apaga o banco "norte_test".
set -euo pipefail
cd "$(dirname "$0")/.."
DB=norte_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in tests/stubs.sql migrations/0001_fase1_financeiro.sql migrations/0002_storage_receipts.sql seed.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"
done
psql -v ON_ERROR_STOP=1 -d $DB -f tests/tests.sql
psql -q -d postgres -c "drop database $DB"
