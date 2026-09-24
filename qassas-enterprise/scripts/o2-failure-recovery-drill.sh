#!/bin/sh
set -eu

ENV_FILE="${QASSAS_TEST_ENV_FILE:-infra/test/.env.test}"
COMPOSE_FILE="${QASSAS_TEST_COMPOSE_FILE:-infra/test/docker-compose.yml}"
BASE_URL="${QASSAS_API_URL:-http://127.0.0.1:3001/api/v1}"
OUT_DIR="artifacts/o2"

mkdir -p "${OUT_DIR}"

before=$(curl --silent --output /dev/null --write-out "%{http_code}" "${BASE_URL}/health/ready")
if [ "${before}" != "200" ]; then
  echo "Expected readiness 200 before drill, got ${before}" >&2
  exit 1
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop opa >/dev/null

failed_closed="false"
for i in $(seq 1 30); do
  code=$(curl --silent --output /dev/null --write-out "%{http_code}" "${BASE_URL}/health/ready" || true)
  if [ "${code}" = "503" ]; then
    failed_closed="true"
    break
  fi
  sleep 1
done

if [ "${failed_closed}" != "true" ]; then
  echo "QASSAS did not fail closed after OPA outage" >&2
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" start opa >/dev/null || true
  exit 1
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" start opa >/dev/null

recovered="false"
for i in $(seq 1 60); do
  code=$(curl --silent --output /dev/null --write-out "%{http_code}" "${BASE_URL}/health/ready" || true)
  if [ "${code}" = "200" ]; then
    recovered="true"
    break
  fi
  sleep 1
done

if [ "${recovered}" != "true" ]; then
  echo "QASSAS readiness did not recover after OPA restart" >&2
  exit 1
fi

cat > "${OUT_DIR}/failure-recovery-evidence.json" <<EOF
{
  "captured_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "drill": "OPA_CONTROL_PLANE_OUTAGE",
  "readiness_before": 200,
  "fail_closed_status": 503,
  "recovered_status": 200,
  "result": "PASS"
}
EOF

cat "${OUT_DIR}/failure-recovery-evidence.json"
