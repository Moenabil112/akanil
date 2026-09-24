#!/bin/sh
set -eu

ENV_FILE="${QASSAS_TEST_ENV_FILE:-infra/test/.env.test}"
COMPOSE_FILE="${QASSAS_TEST_COMPOSE_FILE:-infra/test/docker-compose.yml}"
OUT_DIR="artifacts/o2"
BACKUP_FILE="${OUT_DIR}/qassas-test.dump"
RESTORE_DB="qassas_restore_verify"

set -a
. "${ENV_FILE}"
set +a

mkdir -p "${OUT_DIR}"

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T qassas-db \
  pg_dump -U "${QASSAS_DB_USER}" -d "${QASSAS_DB_NAME}" -Fc > "${BACKUP_FILE}"

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T qassas-db \
  dropdb -U "${QASSAS_DB_USER}" --if-exists --force "${RESTORE_DB}" >/dev/null 2>&1 || true

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T qassas-db \
  createdb -U "${QASSAS_DB_USER}" "${RESTORE_DB}"

cat "${BACKUP_FILE}" | docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T qassas-db \
  pg_restore -U "${QASSAS_DB_USER}" -d "${RESTORE_DB}" --no-owner --no-privileges

migration_count=$(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T qassas-db \
  psql -U "${QASSAS_DB_USER}" -d "${RESTORE_DB}" -Atc \
  "SELECT count(*) FROM qassas_core.schema_migration WHERE migration_name='${QASSAS_REQUIRED_MIGRATION}';" | tr -d '[:space:]')

if [ "${migration_count}" != "1" ]; then
  echo "Restored database does not contain required migration ${QASSAS_REQUIRED_MIGRATION}" >&2
  exit 1
fi

audit_table_count=$(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T qassas-db \
  psql -U "${QASSAS_DB_USER}" -d "${RESTORE_DB}" -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='qassas_audit';" | tr -d '[:space:]')

dump_bytes=$(stat -c%s "${BACKUP_FILE}")

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T qassas-db \
  dropdb -U "${QASSAS_DB_USER}" --if-exists --force "${RESTORE_DB}" >/dev/null

cat > "${OUT_DIR}/backup-restore-evidence.json" <<EOF
{
  "captured_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "backup_format": "pg_dump_custom",
  "backup_bytes": ${dump_bytes},
  "required_migration": "${QASSAS_REQUIRED_MIGRATION}",
  "required_migration_restored": true,
  "restored_audit_schema_table_count": ${audit_table_count},
  "result": "PASS"
}
EOF

cat "${OUT_DIR}/backup-restore-evidence.json"
