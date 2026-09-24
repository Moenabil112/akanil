#!/bin/sh
set -eu

: "${TEMPORAL_ADDRESS:?TEMPORAL_ADDRESS is required}"
: "${TEMPORAL_NAMESPACE:?TEMPORAL_NAMESPACE is required}"

if temporal operator namespace describe --namespace "${TEMPORAL_NAMESPACE}" --address "${TEMPORAL_ADDRESS}" >/dev/null 2>&1; then
  echo "Temporal namespace ${TEMPORAL_NAMESPACE} already exists"
  exit 0
fi

temporal operator namespace create \
  --namespace "${TEMPORAL_NAMESPACE}" \
  --retention 7d \
  --address "${TEMPORAL_ADDRESS}"

for i in $(seq 1 30); do
  if temporal operator namespace describe --namespace "${TEMPORAL_NAMESPACE}" --address "${TEMPORAL_ADDRESS}" >/dev/null 2>&1; then
    echo "Temporal namespace ${TEMPORAL_NAMESPACE} is ready"
    exit 0
  fi
  sleep 1
done

echo "Temporal namespace did not become available" >&2
exit 1
