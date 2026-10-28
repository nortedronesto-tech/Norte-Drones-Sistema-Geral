#!/usr/bin/env bash
# Testa as migrations, o rateio e os níveis de acesso em um Postgres local (sem precisar do Supabase).
# Uso:  PGHOST=localhost PGUSER=postgres bash supabase/tests/run.sh
# Requer um Postgres 15+ acessível via psql. Cria e apaga o banco "norte_test".
set -euo pipefail
cd "$(dirname "$0")/.."
DB=norte_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in tests/stubs.sql migrations/0001_fase1_financeiro.sql migrations/0002_storage_receipts.sql seed.sql \
         tests/fixtures_users.sql migrations/0003_site_publico_admin.sql migrations/0004_hardening_funcoes.sql \
         migrations/0005_niveis_de_acesso.sql migrations/0006_cofre_de_segredos.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"
done
psql -v ON_ERROR_STOP=1 -d $DB -f tests/tests.sql
psql -v ON_ERROR_STOP=1 -d $DB -f tests/access.sql
psql -v ON_ERROR_STOP=1 -d $DB -f tests/secrets.sql
psql -q -d postgres -c "drop database $DB"
